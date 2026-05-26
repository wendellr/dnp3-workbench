#pragma once

#include <nlohmann/json.hpp>

#include <memory>
#include <mutex>
#include <string>
#include <vector>

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
#include <opendnp3/DNP3Manager.h>
#include <opendnp3/channel/IChannel.h>
#include <opendnp3/outstation/IOutstation.h>
#include <opendnp3/outstation/IOutstationApplication.h>
#endif

using json = nlohmann::json;

struct DemoOutstationConfig {
    int port = 20000;
    int outstation_address = 2;
    int master_address = 1;
};

struct DemoPointConfig {
    std::string id;
    std::string type = "binary";
    uint16_t index = 0;
    std::string name;
    std::string value = "false";
    std::string point_class = "class1";
    std::string static_variation;
    std::string event_variation;
    double deadband = 0.0;
    uint8_t flags = 0x01;
};

class DemoOutstationRuntime {
public:
    bool is_compiled() const;
    json start(const DemoOutstationConfig& config);
    json update();
    json stop();
    json status() const;
    json add_point(const json& payload);
    json update_point(const std::string& id, const json& payload);
    json delete_point(const std::string& id);

private:
    mutable std::mutex mutex_;
    bool running_ = false;
    DemoOutstationConfig config_;
    uint32_t counter_ = 0;
    double analog_ = 120.0;
    bool binary_ = false;
    std::string last_error_;
    std::vector<DemoPointConfig> points_;

    json status_locked() const;
    json point_to_json_locked(const DemoPointConfig& point) const;
    void ensure_default_points_locked();
    void apply_point_update_locked(const DemoPointConfig& point);

#if defined(OPENDNP3_ENABLED) && OPENDNP3_ENABLED == 1
    std::shared_ptr<opendnp3::DNP3Manager> manager_;
    std::shared_ptr<opendnp3::IChannel> channel_;
    std::shared_ptr<opendnp3::IOutstation> outstation_;
    std::shared_ptr<opendnp3::IOutstationApplication> application_;

    opendnp3::DatabaseConfig build_database_config_locked() const;
    void apply_update_locked();
#endif
};
