#pragma once

#include <nlohmann/json.hpp>

#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
#include <opendnp3/DNP3Manager.h>
#include <opendnp3/channel/IChannel.h>
#include <opendnp3/channel/IChannelListener.h>
#include <opendnp3/logging/ILogHandler.h>
#include <opendnp3/master/IMaster.h>
#include <opendnp3/master/ISOEHandler.h>
#endif

using json = nlohmann::json;

struct OpenDnp3MasterConfig {
    std::string id;
    std::string host = "127.0.0.1";
    int port = 20000;
    int master_address = 1;
    int outstation_address = 2;
    int response_timeout_seconds = 5;
};

struct OpenDnp3MasterResult {
    bool ok = false;
    bool connected = false;
    std::string detail;
    std::vector<json> points;
    std::vector<json> events;
};

class OpenDnp3MasterBridge {
public:
    OpenDnp3MasterBridge();
    ~OpenDnp3MasterBridge();

    bool is_compiled() const;

    OpenDnp3MasterResult connect(const OpenDnp3MasterConfig& config);
    OpenDnp3MasterResult disconnect(const std::string& id);
    OpenDnp3MasterResult integrity_poll(const std::string& id);
    OpenDnp3MasterResult snapshot(const std::string& id);
    void shutdown();

    struct Cache {
        std::vector<json> points;
        std::vector<json> events;
        std::string channel_state = "CLOSED";
        bool channel_open = false;
        bool response_received = false;
    };

private:
    mutable std::mutex mutex_;
    bool compiled_ = false;
    std::map<std::string, Cache> caches_;

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    struct Session {
        std::shared_ptr<opendnp3::DNP3Manager> manager;
        std::shared_ptr<opendnp3::IChannel> channel;
        std::shared_ptr<opendnp3::IMaster> master;
        std::shared_ptr<opendnp3::ISOEHandler> soe_handler;
        std::shared_ptr<opendnp3::IChannelListener> channel_listener;
        std::shared_ptr<opendnp3::ILogHandler> log_handler;
    };

    std::map<std::string, Session> sessions_;
#endif
};
