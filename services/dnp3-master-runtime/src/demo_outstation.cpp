#include "demo_outstation.h"

#include <algorithm>
#include <cctype>
#include <cstdlib>

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
#include <opendnp3/ConsoleLogger.h>
#include <opendnp3/channel/PrintingChannelListener.h>
#include <opendnp3/gen/DoubleBit.h>
#include <opendnp3/gen/EventAnalogOutputStatusVariation.h>
#include <opendnp3/gen/EventAnalogVariation.h>
#include <opendnp3/gen/EventBinaryOutputStatusVariation.h>
#include <opendnp3/gen/EventBinaryVariation.h>
#include <opendnp3/gen/EventCounterVariation.h>
#include <opendnp3/gen/EventDoubleBinaryVariation.h>
#include <opendnp3/gen/EventFrozenCounterVariation.h>
#include <opendnp3/gen/StaticAnalogOutputStatusVariation.h>
#include <opendnp3/gen/StaticAnalogVariation.h>
#include <opendnp3/gen/StaticBinaryOutputStatusVariation.h>
#include <opendnp3/gen/StaticBinaryVariation.h>
#include <opendnp3/gen/StaticCounterVariation.h>
#include <opendnp3/gen/StaticDoubleBinaryVariation.h>
#include <opendnp3/gen/StaticFrozenCounterVariation.h>
#include <opendnp3/logging/LogLevels.h>
#include <opendnp3/outstation/DefaultOutstationApplication.h>
#include <opendnp3/outstation/EventBufferConfig.h>
#include <opendnp3/outstation/OutstationStackConfig.h>
#include <opendnp3/outstation/SimpleCommandHandler.h>
#include <opendnp3/outstation/UpdateBuilder.h>
#include <opendnp3/util/TimeDuration.h>
#endif

namespace {

std::string point_id(const std::string& type, uint16_t index) {
    return type + ":" + std::to_string(index);
}

std::string normalize_type(std::string type) {
    std::transform(type.begin(), type.end(), type.begin(), [](unsigned char ch) { return std::tolower(ch); });
    if (type == "bi") return "binary";
    if (type == "dbi") return "double_bit_binary";
    if (type == "ai") return "analog";
    if (type == "ctr") return "counter";
    if (type == "fc") return "frozen_counter";
    if (type == "bos") return "binary_output_status";
    if (type == "aos") return "analog_output_status";
    return type;
}

bool bool_value(const std::string& raw) {
    std::string value = raw;
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) { return std::tolower(ch); });
    return value == "true" || value == "1" || value == "on" || value == "closed";
}

double double_value(const std::string& raw) {
    try {
        return std::stod(raw);
    } catch (...) {
        return 0.0;
    }
}

uint32_t uint_value(const std::string& raw) {
    try {
        return static_cast<uint32_t>(std::stoul(raw));
    } catch (...) {
        return 0;
    }
}

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
opendnp3::PointClass point_class_from_string(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) { return std::tolower(ch); });
    if (value == "class0") return opendnp3::PointClass::Class0;
    if (value == "class2") return opendnp3::PointClass::Class2;
    if (value == "class3") return opendnp3::PointClass::Class3;
    return opendnp3::PointClass::Class1;
}

template <class Spec>
typename Spec::enum_type_t enum_from_string_or_default(
    const std::string& value,
    typename Spec::enum_type_t fallback
) {
    if (value.empty()) {
        return fallback;
    }
    try {
        return Spec::from_string(value);
    } catch (...) {
        return fallback;
    }
}
#endif

DemoPointConfig point_from_payload(const json& payload) {
    DemoPointConfig point;
    point.type = normalize_type(payload.value("type", point.type));
    point.index = static_cast<uint16_t>(payload.value("index", static_cast<int>(point.index)));
    point.id = payload.value("id", point_id(point.type, point.index));
    point.name = payload.value("name", point.name.empty() ? point.id : point.name);
    point.value = payload.value("value", point.value);
    point.point_class = payload.value("point_class", point.point_class);
    point.static_variation = payload.value("static_variation", point.static_variation);
    point.event_variation = payload.value("event_variation", point.event_variation);
    point.deadband = payload.value("deadband", point.deadband);
    point.flags = static_cast<uint8_t>(payload.value("flags", static_cast<int>(point.flags)));
    return point;
}

} // namespace

bool DemoOutstationRuntime::is_compiled() const {
#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    return true;
#else
    return false;
#endif
}

json DemoOutstationRuntime::status_locked() const {
    json points = json::array();
    for (const auto& point : points_) {
        points.push_back(point_to_json_locked(point));
    }

    return {
        {"compiled", is_compiled()},
        {"running", running_},
        {"port", config_.port},
        {"outstation_address", config_.outstation_address},
        {"master_address", config_.master_address},
        {"binary", binary_},
        {"analog", analog_},
        {"counter", counter_},
        {"points", points},
        {"last_error", last_error_}
    };
}

json DemoOutstationRuntime::point_to_json_locked(const DemoPointConfig& point) const {
    return {
        {"id", point.id},
        {"type", point.type},
        {"index", point.index},
        {"name", point.name},
        {"value", point.value},
        {"point_class", point.point_class},
        {"static_variation", point.static_variation},
        {"event_variation", point.event_variation},
        {"deadband", point.deadband},
        {"flags", point.flags}
    };
}

void DemoOutstationRuntime::ensure_default_points_locked() {
    if (!points_.empty()) {
        return;
    }

    points_.push_back({"binary:0", "binary", 0, "Binary Input 0", "true", "class1", "Group1Var2", "Group2Var2", 0.0, 0x01});
    points_.push_back({"analog:0", "analog", 0, "Analog Input 0", "123.45", "class2", "Group30Var1", "Group32Var1", 0.0, 0x01});
    points_.push_back({"counter:0", "counter", 0, "Counter 0", "7", "class3", "Group20Var1", "Group22Var1", 0.0, 0x01});
    points_.push_back({"double_bit_binary:0", "double_bit_binary", 0, "Double-bit Binary 0", "2", "class1", "Group3Var2", "Group4Var2", 0.0, 0x01});
    points_.push_back({"binary_output_status:0", "binary_output_status", 0, "Binary Output Status 0", "false", "class1", "Group10Var2", "Group11Var2", 0.0, 0x01});
    points_.push_back({"analog_output_status:0", "analog_output_status", 0, "Analog Output Status 0", "133.45", "class2", "Group40Var1", "Group42Var1", 0.0, 0x01});
}

json DemoOutstationRuntime::status() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return status_locked();
}

json DemoOutstationRuntime::start(const DemoOutstationConfig& config) {
    if (!is_compiled()) {
        return {{"ok", false}, {"detail", "OpenDNP3 is not compiled into this runtime."}, {"outstation", status()}};
    }

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    std::lock_guard<std::mutex> lock(mutex_);
    try {
        if (running_) {
            return {{"ok", true}, {"detail", "demo outstation already running"}, {"outstation", status_locked()}};
        }

        config_ = config;
        last_error_.clear();
        ensure_default_points_locked();

        const auto log_levels = opendnp3::levels::NORMAL;
        manager_ = std::make_shared<opendnp3::DNP3Manager>(1, opendnp3::ConsoleLogger::Create());
        channel_ = manager_->AddTCPServer(
            "demo-outstation-server",
            log_levels,
            opendnp3::ServerAcceptMode::CloseExisting,
            opendnp3::IPEndpoint("0.0.0.0", static_cast<uint16_t>(config_.port)),
            opendnp3::PrintingChannelListener::Create()
        );

        opendnp3::OutstationStackConfig stack_config(build_database_config_locked());
        stack_config.outstation.eventBufferConfig = opendnp3::EventBufferConfig::AllTypes(100);
        stack_config.outstation.params.allowUnsolicited = true;
        stack_config.link.LocalAddr = static_cast<uint16_t>(config_.outstation_address);
        stack_config.link.RemoteAddr = static_cast<uint16_t>(config_.master_address);
        stack_config.link.KeepAliveTimeout = opendnp3::TimeDuration::Max();

        application_ = opendnp3::DefaultOutstationApplication::Create();
        outstation_ = channel_->AddOutstation(
            "demo-outstation",
            opendnp3::SuccessCommandHandler::Create(),
            application_,
            stack_config
        );
        outstation_->Enable();
        running_ = true;
        apply_update_locked();

        return {{"ok", true}, {"detail", "demo outstation started"}, {"outstation", status_locked()}};
    } catch (const std::exception& exc) {
        last_error_ = exc.what();
        running_ = false;
        outstation_.reset();
        channel_.reset();
        if (manager_) {
            manager_->Shutdown();
            manager_.reset();
        }
        return {{"ok", false}, {"detail", last_error_}, {"outstation", status_locked()}};
    }
#else
    return {{"ok", false}, {"detail", "OpenDNP3 is not available."}, {"outstation", status()}};
#endif
}

json DemoOutstationRuntime::update() {
    if (!is_compiled()) {
        return {{"ok", false}, {"detail", "OpenDNP3 is not compiled into this runtime."}, {"outstation", status()}};
    }

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    std::lock_guard<std::mutex> lock(mutex_);
    if (!running_ || !outstation_) {
        return {{"ok", false}, {"detail", "demo outstation is not running"}, {"outstation", status_locked()}};
    }

    for (auto& point : points_) {
        if (point.type == "binary" || point.type == "binary_output_status") {
            point.value = bool_value(point.value) ? "false" : "true";
        } else if (point.type == "analog" || point.type == "analog_output_status") {
            point.value = std::to_string(double_value(point.value) + 1.25);
        } else if (point.type == "counter" || point.type == "frozen_counter") {
            point.value = std::to_string(uint_value(point.value) + 1);
        }
    }
    apply_update_locked();
    return {{"ok", true}, {"detail", "demo measurements updated"}, {"outstation", status_locked()}};
#else
    return {{"ok", false}, {"detail", "OpenDNP3 is not available."}, {"outstation", status()}};
#endif
}

json DemoOutstationRuntime::stop() {
#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    std::lock_guard<std::mutex> lock(mutex_);
    if (outstation_) {
        outstation_->Disable();
        outstation_.reset();
    }
    if (channel_) {
        channel_->Shutdown();
        channel_.reset();
    }
    if (manager_) {
        manager_->Shutdown();
        manager_.reset();
    }
    running_ = false;
    return {{"ok", true}, {"detail", "demo outstation stopped"}, {"outstation", status_locked()}};
#else
    return {{"ok", true}, {"detail", "demo outstation stopped"}, {"outstation", status()}};
#endif
}

json DemoOutstationRuntime::add_point(const json& payload) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (running_) {
        return {{"ok", false}, {"detail", "Stop the demo outstation before adding points."}, {"outstation", status_locked()}};
    }

    auto point = point_from_payload(payload);
    const auto duplicate = std::find_if(points_.begin(), points_.end(), [&](const DemoPointConfig& existing) {
        return existing.type == point.type && existing.index == point.index;
    });
    if (duplicate != points_.end()) {
        return {{"ok", false}, {"detail", "A point with the same type and index already exists."}, {"outstation", status_locked()}};
    }

    points_.push_back(point);
    return {{"ok", true}, {"detail", "point added"}, {"outstation", status_locked()}};
}

json DemoOutstationRuntime::update_point(const std::string& id, const json& payload) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::find_if(points_.begin(), points_.end(), [&](const DemoPointConfig& point) {
        return point.id == id;
    });
    if (it == points_.end()) {
        return {{"ok", false}, {"detail", "point not found"}, {"outstation", status_locked()}};
    }

    if (!running_) {
        auto updated = *it;
        if (payload.contains("type")) updated.type = normalize_type(payload.value("type", updated.type));
        if (payload.contains("index")) updated.index = static_cast<uint16_t>(payload.value("index", static_cast<int>(updated.index)));
        updated.id = payload.value("id", point_id(updated.type, updated.index));
        updated.name = payload.value("name", updated.name);
        updated.value = payload.value("value", updated.value);
        updated.point_class = payload.value("point_class", updated.point_class);
        updated.static_variation = payload.value("static_variation", updated.static_variation);
        updated.event_variation = payload.value("event_variation", updated.event_variation);
        updated.deadband = payload.value("deadband", updated.deadband);
        updated.flags = static_cast<uint8_t>(payload.value("flags", static_cast<int>(updated.flags)));
        *it = updated;
    } else {
        it->value = payload.value("value", it->value);
        it->flags = static_cast<uint8_t>(payload.value("flags", static_cast<int>(it->flags)));
        apply_point_update_locked(*it);
    }

    return {{"ok", true}, {"detail", "point updated"}, {"outstation", status_locked()}};
}

json DemoOutstationRuntime::delete_point(const std::string& id) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (running_) {
        return {{"ok", false}, {"detail", "Stop the demo outstation before deleting points."}, {"outstation", status_locked()}};
    }

    const auto before = points_.size();
    points_.erase(std::remove_if(points_.begin(), points_.end(), [&](const DemoPointConfig& point) {
        return point.id == id;
    }), points_.end());

    return {
        {"ok", points_.size() != before},
        {"detail", points_.size() != before ? "point deleted" : "point not found"},
        {"outstation", status_locked()}
    };
}

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
opendnp3::DatabaseConfig DemoOutstationRuntime::build_database_config_locked() const {
    opendnp3::DatabaseConfig database;
    for (const auto& point : points_) {
        const auto clazz = point_class_from_string(point.point_class);
        if (point.type == "binary") {
            database.binary_input[point.index].clazz = clazz;
            database.binary_input[point.index].svariation = enum_from_string_or_default<opendnp3::StaticBinaryVariationSpec>(
                point.static_variation, database.binary_input[point.index].svariation);
            database.binary_input[point.index].evariation = enum_from_string_or_default<opendnp3::EventBinaryVariationSpec>(
                point.event_variation, database.binary_input[point.index].evariation);
        } else if (point.type == "double_bit_binary") {
            database.double_binary[point.index].clazz = clazz;
            database.double_binary[point.index].svariation = enum_from_string_or_default<opendnp3::StaticDoubleBinaryVariationSpec>(
                point.static_variation, database.double_binary[point.index].svariation);
            database.double_binary[point.index].evariation = enum_from_string_or_default<opendnp3::EventDoubleBinaryVariationSpec>(
                point.event_variation, database.double_binary[point.index].evariation);
        } else if (point.type == "analog") {
            database.analog_input[point.index].clazz = clazz;
            database.analog_input[point.index].svariation = enum_from_string_or_default<opendnp3::StaticAnalogVariationSpec>(
                point.static_variation, database.analog_input[point.index].svariation);
            database.analog_input[point.index].evariation = enum_from_string_or_default<opendnp3::EventAnalogVariationSpec>(
                point.event_variation, database.analog_input[point.index].evariation);
            database.analog_input[point.index].deadband = point.deadband;
        } else if (point.type == "counter") {
            database.counter[point.index].clazz = clazz;
            database.counter[point.index].svariation = enum_from_string_or_default<opendnp3::StaticCounterVariationSpec>(
                point.static_variation, database.counter[point.index].svariation);
            database.counter[point.index].evariation = enum_from_string_or_default<opendnp3::EventCounterVariationSpec>(
                point.event_variation, database.counter[point.index].evariation);
            database.counter[point.index].deadband = static_cast<uint32_t>(point.deadband);
        } else if (point.type == "frozen_counter") {
            database.frozen_counter[point.index].clazz = clazz;
            database.frozen_counter[point.index].svariation = enum_from_string_or_default<opendnp3::StaticFrozenCounterVariationSpec>(
                point.static_variation, database.frozen_counter[point.index].svariation);
            database.frozen_counter[point.index].evariation = enum_from_string_or_default<opendnp3::EventFrozenCounterVariationSpec>(
                point.event_variation, database.frozen_counter[point.index].evariation);
            database.frozen_counter[point.index].deadband = static_cast<uint32_t>(point.deadband);
        } else if (point.type == "binary_output_status") {
            database.binary_output_status[point.index].clazz = clazz;
            database.binary_output_status[point.index].svariation = enum_from_string_or_default<opendnp3::StaticBinaryOutputStatusVariationSpec>(
                point.static_variation, database.binary_output_status[point.index].svariation);
            database.binary_output_status[point.index].evariation = enum_from_string_or_default<opendnp3::EventBinaryOutputStatusVariationSpec>(
                point.event_variation, database.binary_output_status[point.index].evariation);
        } else if (point.type == "analog_output_status") {
            database.analog_output_status[point.index].clazz = clazz;
            database.analog_output_status[point.index].svariation = enum_from_string_or_default<opendnp3::StaticAnalogOutputStatusVariationSpec>(
                point.static_variation, database.analog_output_status[point.index].svariation);
            database.analog_output_status[point.index].evariation = enum_from_string_or_default<opendnp3::EventAnalogOutputStatusVariationSpec>(
                point.event_variation, database.analog_output_status[point.index].evariation);
            database.analog_output_status[point.index].deadband = point.deadband;
        }
    }
    return database;
}

void DemoOutstationRuntime::apply_point_update_locked(const DemoPointConfig& point) {
    opendnp3::UpdateBuilder builder;
    if (point.type == "binary") {
        builder.Update(opendnp3::Binary(bool_value(point.value), opendnp3::Flags(point.flags), application_->Now()), point.index);
    } else if (point.type == "double_bit_binary") {
        const auto state = uint_value(point.value) == 2 ? opendnp3::DoubleBit::DETERMINED_ON : opendnp3::DoubleBit::DETERMINED_OFF;
        builder.Update(opendnp3::DoubleBitBinary(state, opendnp3::Flags(point.flags), application_->Now()), point.index);
    } else if (point.type == "analog") {
        builder.Update(opendnp3::Analog(double_value(point.value), opendnp3::Flags(point.flags), application_->Now()), point.index);
    } else if (point.type == "counter") {
        builder.Update(opendnp3::Counter(uint_value(point.value), opendnp3::Flags(point.flags), application_->Now()), point.index);
    } else if (point.type == "frozen_counter") {
        builder.FreezeCounter(point.index, false);
    } else if (point.type == "binary_output_status") {
        builder.Update(opendnp3::BinaryOutputStatus(bool_value(point.value), opendnp3::Flags(point.flags), application_->Now()), point.index);
    } else if (point.type == "analog_output_status") {
        builder.Update(opendnp3::AnalogOutputStatus(double_value(point.value), opendnp3::Flags(point.flags), application_->Now()), point.index);
    }
    outstation_->Apply(builder.Build());
}

void DemoOutstationRuntime::apply_update_locked() {
    for (const auto& point : points_) {
        apply_point_update_locked(point);
    }

    for (const auto& point : points_) {
        if (point.type == "binary" && point.index == 0) binary_ = bool_value(point.value);
        if (point.type == "analog" && point.index == 0) analog_ = double_value(point.value);
        if (point.type == "counter" && point.index == 0) counter_ = uint_value(point.value);
    }
}
#endif
