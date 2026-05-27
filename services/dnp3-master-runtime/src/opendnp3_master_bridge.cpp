#include "opendnp3_master_bridge.h"

#include <algorithm>
#include <chrono>
#include <cctype>
#include <cstddef>
#include <ctime>
#include <thread>

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
#include <opendnp3/app/ClassField.h>
#include <opendnp3/app/GroupVariationID.h>
#include <opendnp3/app/MeasurementTypes.h>
#include <opendnp3/app/parsing/ICollection.h>
#include <opendnp3/channel/IChannelListener.h>
#include <opendnp3/gen/ChannelState.h>
#include <opendnp3/logging/LogLevels.h>
#include <opendnp3/master/DefaultMasterApplication.h>
#include <opendnp3/master/MasterStackConfig.h>
#include <opendnp3/util/TimeDuration.h>
#endif

namespace {

std::string bridge_now_iso() {
    std::time_t now = std::time(nullptr);
    char buffer[32];
    std::strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", std::gmtime(&now));
    return std::string(buffer);
}

json event_json(const std::string& type, const std::string& status, const std::string& detail) {
    return {
        {"timestamp", bridge_now_iso()},
        {"type", type},
        {"status", status},
        {"detail", detail}
    };
}

void append_event(std::vector<json>& events, const json& event) {
    constexpr std::size_t max_events = 2000;
    constexpr std::size_t keep_events = 1000;

    events.push_back(event);
    if (events.size() > max_events) {
        events.erase(events.begin(), events.begin() + static_cast<std::ptrdiff_t>(events.size() - keep_events));
    }
}

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1

std::string compact_log_message(const char* id, const char* location, const char* message) {
    std::string detail;
    if (id && id[0] != '\0') {
        detail += "[";
        detail += id;
        detail += "] ";
    }
    if (message && message[0] != '\0') {
        detail += message;
    }
    if (location && location[0] != '\0') {
        detail += " @ ";
        detail += location;
    }
    return detail;
}

class RuntimeLogHandler final : public opendnp3::ILogHandler {
public:
    RuntimeLogHandler(OpenDnp3MasterBridge::Cache& cache, std::mutex& mutex)
        : cache_(cache), mutex_(mutex) {}

    void log(
        opendnp3::ModuleId,
        const char* id,
        opendnp3::LogLevel level,
        char const* location,
        char const* message
    ) override {
        const char* level_text = opendnp3::LogFlagToString(level);
        std::string status = level_text && level_text[0] != '\0' ? level_text : "LOG";
        std::transform(status.begin(), status.end(), status.begin(), [](unsigned char c) {
            return static_cast<char>(std::tolower(c));
        });

        std::lock_guard<std::mutex> lock(mutex_);
        append_event(cache_.events, event_json("opendnp3_log", status, compact_log_message(id, location, message)));
    }

private:
    OpenDnp3MasterBridge::Cache& cache_;
    std::mutex& mutex_;
};

std::string flags_to_hex(const opendnp3::Flags& flags) {
    constexpr char hex[] = "0123456789ABCDEF";
    std::string out = "0x";
    out.push_back(hex[(flags.value >> 4) & 0x0F]);
    out.push_back(hex[flags.value & 0x0F]);
    return out;
}

template <class T>
void collect_numeric_points(
    const std::string& type,
    const opendnp3::ICollection<opendnp3::Indexed<T>>& values,
    std::vector<json>& points
) {
    values.ForeachItem([&](const opendnp3::Indexed<T>& item) {
        points.push_back({
            {"index", item.index},
            {"type", type},
            {"value", item.value.value},
            {"quality", flags_to_hex(item.value.flags)},
            {"dnp_time", item.value.time.value},
            {"timestamp", bridge_now_iso()}
        });
    });
}

class RuntimeSOEHandler final : public opendnp3::ISOEHandler {
public:
    RuntimeSOEHandler(std::string master_id, OpenDnp3MasterBridge::Cache& cache, std::mutex& mutex)
        : master_id_(std::move(master_id)), cache_(cache), mutex_(mutex) {}

    void BeginFragment(const opendnp3::ResponseInfo&) override {}

    void EndFragment(const opendnp3::ResponseInfo&) override {
        std::lock_guard<std::mutex> lock(mutex_);
        cache_.response_received = true;
        append_event(cache_.events, event_json("soe_fragment", "received", "SOE fragment processed"));
    }

    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::Binary>>& values) override {
        std::lock_guard<std::mutex> lock(mutex_);
        values.ForeachItem([&](const opendnp3::Indexed<opendnp3::Binary>& item) {
            cache_.points.push_back({
                {"index", item.index},
                {"type", "binary"},
                {"value", item.value.value},
                {"quality", flags_to_hex(item.value.flags)},
                {"dnp_time", item.value.time.value},
                {"timestamp", bridge_now_iso()}
            });
        });
    }

    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::DoubleBitBinary>>& values) override {
        std::lock_guard<std::mutex> lock(mutex_);
        values.ForeachItem([&](const opendnp3::Indexed<opendnp3::DoubleBitBinary>& item) {
            cache_.points.push_back({
                {"index", item.index},
                {"type", "double_bit_binary"},
                {"value", static_cast<int>(item.value.value)},
                {"quality", flags_to_hex(item.value.flags)},
                {"dnp_time", item.value.time.value},
                {"timestamp", bridge_now_iso()}
            });
        });
    }

    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::Analog>>& values) override {
        std::lock_guard<std::mutex> lock(mutex_);
        collect_numeric_points("analog", values, cache_.points);
    }

    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::Counter>>& values) override {
        std::lock_guard<std::mutex> lock(mutex_);
        collect_numeric_points("counter", values, cache_.points);
    }

    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::FrozenCounter>>& values) override {
        std::lock_guard<std::mutex> lock(mutex_);
        collect_numeric_points("frozen_counter", values, cache_.points);
    }

    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::BinaryOutputStatus>>& values) override {
        std::lock_guard<std::mutex> lock(mutex_);
        values.ForeachItem([&](const opendnp3::Indexed<opendnp3::BinaryOutputStatus>& item) {
            cache_.points.push_back({
                {"index", item.index},
                {"type", "binary_output_status"},
                {"value", item.value.value},
                {"quality", flags_to_hex(item.value.flags)},
                {"dnp_time", item.value.time.value},
                {"timestamp", bridge_now_iso()}
            });
        });
    }

    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::AnalogOutputStatus>>& values) override {
        std::lock_guard<std::mutex> lock(mutex_);
        collect_numeric_points("analog_output_status", values, cache_.points);
    }

    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::OctetString>>&) override {}
    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::TimeAndInterval>>&) override {}
    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::BinaryCommandEvent>>&) override {}
    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::Indexed<opendnp3::AnalogCommandEvent>>&) override {}
    void Process(const opendnp3::HeaderInfo&, const opendnp3::ICollection<opendnp3::DNPTime>&) override {}

private:
    std::string master_id_;
    OpenDnp3MasterBridge::Cache& cache_;
    std::mutex& mutex_;
};

class RuntimeChannelListener final : public opendnp3::IChannelListener {
public:
    RuntimeChannelListener(OpenDnp3MasterBridge::Cache& cache, std::mutex& mutex)
        : cache_(cache), mutex_(mutex) {}

    void OnStateChange(opendnp3::ChannelState state) override {
        std::lock_guard<std::mutex> lock(mutex_);
        cache_.channel_state = opendnp3::ChannelStateSpec::to_string(state);
        cache_.channel_open = state == opendnp3::ChannelState::OPEN;
        append_event(cache_.events, event_json("channel", cache_.channel_state, "OpenDNP3 channel state changed"));
    }

private:
    OpenDnp3MasterBridge::Cache& cache_;
    std::mutex& mutex_;
};

#endif

} // namespace

OpenDnp3MasterBridge::OpenDnp3MasterBridge() : compiled_(OPENDNP3_ENABLED == 1) {}

OpenDnp3MasterBridge::~OpenDnp3MasterBridge() {
    shutdown();
}

bool OpenDnp3MasterBridge::is_compiled() const {
    return compiled_;
}

OpenDnp3MasterResult OpenDnp3MasterBridge::connect(const OpenDnp3MasterConfig& config) {
    if (!compiled_) {
        return {false, false, "OpenDNP3 master bridge is not compiled into this runtime.", {}, {}};
    }

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    try {
        Session old_session;
        bool has_old_session = false;
        Cache* cache_ptr = nullptr;

        {
            std::lock_guard<std::mutex> lock(mutex_);

            auto existing = sessions_.find(config.id);
            if (existing != sessions_.end()) {
                old_session = existing->second;
                has_old_session = true;
                sessions_.erase(existing);
            }

            auto& cache = caches_[config.id];
            cache_ptr = &cache;
            cache.channel_state = "CLOSED";
            cache.channel_open = false;
            cache.response_received = false;
            append_event(cache.events, event_json("connect", "starting", "Creating OpenDNP3 TCP client master"));
        }

        if (has_old_session) {
            if (old_session.master) {
                old_session.master->Disable();
            }
            if (old_session.channel) {
                old_session.channel->Shutdown();
            }
            if (old_session.manager) {
                old_session.manager->Shutdown();
            }
        }

        const auto log_levels = opendnp3::levels::NORMAL | opendnp3::levels::ALL_COMMS;
        Session session;
        session.log_handler = std::make_shared<RuntimeLogHandler>(*cache_ptr, mutex_);
        session.manager = std::make_shared<opendnp3::DNP3Manager>(1, session.log_handler);
        session.channel_listener = std::make_shared<RuntimeChannelListener>(*cache_ptr, mutex_);
        session.channel = session.manager->AddTCPClient(
            "dnp3-master-" + config.id,
            log_levels,
            opendnp3::ChannelRetry::Default(),
            {opendnp3::IPEndpoint(config.host, static_cast<uint16_t>(config.port))},
            "0.0.0.0",
            session.channel_listener
        );

        opendnp3::MasterStackConfig stack_config;
        stack_config.master.responseTimeout = opendnp3::TimeDuration::Seconds(config.response_timeout_seconds);
        stack_config.master.disableUnsolOnStartup = true;
        stack_config.link.LocalAddr = static_cast<uint16_t>(config.master_address);
        stack_config.link.RemoteAddr = static_cast<uint16_t>(config.outstation_address);

        session.soe_handler = std::make_shared<RuntimeSOEHandler>(config.id, *cache_ptr, mutex_);
        session.master = session.channel->AddMaster(
            "master-" + config.id,
            session.soe_handler,
            opendnp3::DefaultMasterApplication::Create(),
            stack_config
        );
        session.master->Enable();

        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto& cache = caches_[config.id];
            append_event(cache.events, event_json("connect", "enabled", "OpenDNP3 master enabled; waiting for TCP channel OPEN"));
            sessions_[config.id] = session;
        }

        for (int i = 0; i < 30; ++i) {
            {
                std::lock_guard<std::mutex> lock(mutex_);
                auto& cache = caches_[config.id];
                if (cache.channel_open) {
                    append_event(cache.events, event_json("connect", "open", "OpenDNP3 TCP channel is OPEN"));
                    return {true, true, "channel_open", cache.points, cache.events};
                }
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }

        Session timeout_session;
        bool has_timeout_session = false;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            auto& cache = caches_[config.id];
            append_event(cache.events, event_json("connect", "timeout", "OpenDNP3 TCP channel did not open"));
            auto it = sessions_.find(config.id);
            if (it != sessions_.end()) {
                timeout_session = it->second;
                has_timeout_session = true;
                sessions_.erase(it);
            }
        }
        if (has_timeout_session) {
            if (timeout_session.master) {
                timeout_session.master->Disable();
            }
            if (timeout_session.channel) {
                timeout_session.channel->Shutdown();
            }
            if (timeout_session.manager) {
                timeout_session.manager->Shutdown();
            }
        }
        std::lock_guard<std::mutex> lock(mutex_);
        auto& cache = caches_[config.id];
        return {false, false, "channel_not_open", cache.points, cache.events};
    } catch (const std::exception& exc) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto& cache = caches_[config.id];
        append_event(cache.events, event_json("connect", "error", exc.what()));
        return {false, false, exc.what(), cache.points, cache.events};
    }
#else
    return {false, false, "OpenDNP3 master bridge is not available in this build.", {}, {}};
#endif
}

OpenDnp3MasterResult OpenDnp3MasterBridge::disconnect(const std::string& id) {
#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    Session session;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = sessions_.find(id);
        if (it == sessions_.end()) {
            return {false, false, "master session not found", {}, {}};
        }
        session = it->second;
        sessions_.erase(it);
    }
    if (session.master) {
        session.master->Disable();
    }
    if (session.channel) {
        session.channel->Shutdown();
    }
    if (session.manager) {
        session.manager->Shutdown();
    }
    std::lock_guard<std::mutex> lock(mutex_);
    auto& cache = caches_[id];
    append_event(cache.events, event_json("disconnect", "ok", "OpenDNP3 master stopped"));
    cache.channel_state = "CLOSED";
        cache.channel_open = false;
        return {true, false, "ok", cache.points, cache.events};
#else
    return {true, false, "scaffold disconnected", {}, {}};
#endif
}

OpenDnp3MasterResult OpenDnp3MasterBridge::integrity_poll(const std::string& id) {
    if (!compiled_) {
        return {false, false, "OpenDNP3 master bridge is not compiled into this runtime.", {}, {}};
    }

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    std::shared_ptr<opendnp3::IMaster> master;
    std::shared_ptr<opendnp3::ISOEHandler> soe_handler;

    {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = sessions_.find(id);
        if (it == sessions_.end() || !it->second.master) {
            return {false, false, "master session is not connected", {}, {}};
        }
        auto& cache = caches_[id];
        if (!cache.channel_open) {
            append_event(cache.events, event_json("integrity_poll", "blocked", "TCP channel is not OPEN"));
            return {false, false, "channel_not_open", cache.points, cache.events};
        }

        cache.points.clear();
        cache.response_received = false;
        append_event(cache.events, event_json("integrity_poll", "queued", "Class 0/1/2/3 scan queued"));
        master = it->second.master;
        soe_handler = it->second.soe_handler;
    }

    master->ScanClasses(opendnp3::ClassField::AllClasses(), soe_handler);
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    return snapshot(id);
#else
    return {false, false, "OpenDNP3 master bridge is not available in this build.", {}, {}};
#endif
}

OpenDnp3MasterResult OpenDnp3MasterBridge::snapshot(const std::string& id) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto cache_it = caches_.find(id);
    if (cache_it == caches_.end()) {
        return {false, false, "master cache not found", {}, {}};
    }

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    const bool connected = sessions_.find(id) != sessions_.end() && cache_it->second.channel_open;
#else
    const bool connected = false;
#endif
    return {true, connected, "ok", cache_it->second.points, cache_it->second.events};
}

void OpenDnp3MasterBridge::shutdown() {
#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    std::map<std::string, Session> sessions;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        sessions.swap(sessions_);
    }
    for (auto& [id, session] : sessions) {
        if (session.master) {
            session.master->Disable();
        }
        if (session.channel) {
            session.channel->Shutdown();
        }
        if (session.manager) {
            session.manager->Shutdown();
        }
    }
#endif
}
