#include <microhttpd.h>
#include <nlohmann/json.hpp>

#include "demo_outstation.h"
#include "opendnp3_master_bridge.h"

#include <csignal>
#include <cstdlib>
#include <ctime>
#include <iostream>
#include <map>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

using json = nlohmann::json;

#ifndef OPENDNP3_ENABLED
#define OPENDNP3_ENABLED 0
#endif

struct MasterSession {
    std::string id;
    std::string name;
    std::string host = "127.0.0.1";
    int port = 20000;
    int master_address = 1;
    int outstation_address = 2;
    bool connected = false;
    std::string last_error;
    std::vector<json> points;
    std::vector<json> events;
};

std::mutex g_mutex;
std::map<std::string, MasterSession> g_masters;
OpenDnp3MasterBridge g_bridge;
DemoOutstationRuntime g_demo_outstation;
bool g_running = true;

std::string now_iso() {
    std::time_t now = std::time(nullptr);
    char buffer[32];
    std::strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", std::gmtime(&now));
    return std::string(buffer);
}

int env_int(const char* name, int fallback) {
    const char* raw = std::getenv(name);
    if (raw == nullptr) {
        return fallback;
    }
    try {
        return std::stoi(raw);
    } catch (...) {
        return fallback;
    }
}

json master_to_json(const MasterSession& master) {
    return {
        {"id", master.id},
        {"name", master.name},
        {"host", master.host},
        {"port", master.port},
        {"master_address", master.master_address},
        {"outstation_address", master.outstation_address},
        {"connected", master.connected},
        {"last_error", master.last_error},
        {"points_total", master.points.size()},
        {"events_total", master.events.size()}
    };
}

std::vector<std::string> split_path(const std::string& raw_url) {
    std::string path = raw_url;
    const auto query_pos = path.find('?');
    if (query_pos != std::string::npos) {
        path = path.substr(0, query_pos);
    }

    std::vector<std::string> parts;
    std::string current;
    for (const char ch : path) {
        if (ch == '/') {
            if (!current.empty()) {
                parts.push_back(current);
                current.clear();
            }
        } else {
            current.push_back(ch);
        }
    }
    if (!current.empty()) {
        parts.push_back(current);
    }
    return parts;
}

json handle_health() {
    std::lock_guard<std::mutex> lock(g_mutex);
    return {
        {"status", "ok"},
        {"service", "dnp3-master-runtime"},
        {"opendnp3_compiled", g_bridge.is_compiled()},
        {"masters", g_masters.size()},
        {"demo_outstation", g_demo_outstation.status()}
    };
}

json handle_runtime() {
    std::lock_guard<std::mutex> lock(g_mutex);
    return {
        {"service", "dnp3-master-runtime"},
        {"engine_mode", g_bridge.is_compiled() ? "opendnp3-master" : "scaffold"},
        {"opendnp3_compiled", g_bridge.is_compiled()},
        {"hint", g_bridge.is_compiled()
            ? "OpenDNP3 master bridge is compiled. Use /masters/{id}/connect and /poll/integrity."
            : "Scaffold mode only. Build with ENABLE_OPENDNP3=ON for real protocol support."},
        {"masters", g_masters.size()},
        {"demo_outstation", g_demo_outstation.status()}
    };
}

json handle_demo_outstation_start(const json& payload) {
    DemoOutstationConfig config;
    config.port = payload.value("port", config.port);
    config.outstation_address = payload.value("outstation_address", config.outstation_address);
    config.master_address = payload.value("master_address", config.master_address);
    return g_demo_outstation.start(config);
}

json handle_demo_outstation_update() {
    return g_demo_outstation.update();
}

json handle_demo_outstation_stop() {
    return g_demo_outstation.stop();
}

json handle_demo_outstation_add_point(const json& payload) {
    return g_demo_outstation.add_point(payload);
}

json handle_demo_outstation_update_point(const std::string& id, const json& payload) {
    return g_demo_outstation.update_point(id, payload);
}

json handle_demo_outstation_delete_point(const std::string& id) {
    return g_demo_outstation.delete_point(id);
}

json handle_create_master(const json& payload) {
    MasterSession master;
    master.id = payload.value("id", std::string("master-") + std::to_string(std::time(nullptr)) + "-" + std::to_string(g_masters.size() + 1));
    master.name = payload.value("name", master.id);
    master.host = payload.value("host", master.host);
    master.port = payload.value("port", master.port);
    master.master_address = payload.value("master_address", master.master_address);
    master.outstation_address = payload.value("outstation_address", master.outstation_address);

    std::lock_guard<std::mutex> lock(g_mutex);
    g_masters[master.id] = master;
    return {{"ok", true}, {"master", master_to_json(master)}};
}

json handle_list_masters() {
    std::lock_guard<std::mutex> lock(g_mutex);
    json masters = json::array();
    for (auto& [id, master] : g_masters) {
        const auto snapshot = g_bridge.snapshot(id);
        if (snapshot.ok) {
            master.points = snapshot.points;
            master.events = snapshot.events;
            master.connected = snapshot.connected;
        }
        masters.push_back(master_to_json(master));
    }
    return {{"masters", masters}};
}

json handle_master_status(const std::string& id) {
    const auto snapshot = g_bridge.snapshot(id);
    std::lock_guard<std::mutex> lock(g_mutex);
    auto it = g_masters.find(id);
    if (it == g_masters.end()) {
        return {{"ok", false}, {"detail", "master not found"}};
    }
    if (snapshot.ok) {
        it->second.points = snapshot.points;
        it->second.events = snapshot.events;
        it->second.connected = snapshot.connected;
    }
    return {{"ok", true}, {"master", master_to_json(it->second)}};
}

json handle_connect_master(const std::string& id) {
    MasterSession master;
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto it = g_masters.find(id);
        if (it == g_masters.end()) {
            return {{"ok", false}, {"detail", "master not found"}};
        }
        master = it->second;
    }

    OpenDnp3MasterConfig config;
    config.id = master.id;
    config.host = master.host;
    config.port = master.port;
    config.master_address = master.master_address;
    config.outstation_address = master.outstation_address;

    const auto result = g_bridge.connect(config);
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        auto& stored = g_masters[id];
        stored.connected = result.connected;
        stored.last_error = result.ok ? "" : result.detail;
        stored.points = result.points;
        stored.events = result.events;
        master = stored;
    }

    return {{"ok", result.ok}, {"master", master_to_json(master)}, {"detail", result.detail}};
}

json handle_disconnect_master(const std::string& id) {
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        if (g_masters.find(id) == g_masters.end()) {
            return {{"ok", false}, {"detail", "master not found"}};
        }
    }

    const auto result = g_bridge.disconnect(id);
    std::lock_guard<std::mutex> lock(g_mutex);
    auto& master = g_masters[id];
    master.connected = false;
    master.last_error = result.ok ? "" : result.detail;
    master.points = result.points;
    master.events = result.events;
    return {{"ok", result.ok}, {"master", master_to_json(master)}, {"detail", result.detail}};
}

json handle_poll_master(const std::string& id) {
    {
        std::lock_guard<std::mutex> lock(g_mutex);
        if (g_masters.find(id) == g_masters.end()) {
            return {{"ok", false}, {"detail", "master not found"}};
        }
    }

    const auto result = g_bridge.integrity_poll(id);
    std::lock_guard<std::mutex> lock(g_mutex);
    auto& master = g_masters[id];
    master.connected = result.connected;
    master.last_error = result.ok ? "" : result.detail;
    master.points = result.points;
    master.events = result.events;
    return {{"ok", result.ok}, {"detail", result.detail}, {"points", master.points}, {"events", master.events}};
}

json handle_points(const std::string& id) {
    const auto snapshot = g_bridge.snapshot(id);
    std::lock_guard<std::mutex> lock(g_mutex);
    auto it = g_masters.find(id);
    if (it == g_masters.end()) {
        return {{"ok", false}, {"detail", "master not found"}};
    }
    if (snapshot.ok) {
        it->second.points = snapshot.points;
        it->second.events = snapshot.events;
        it->second.connected = snapshot.connected;
    }
    return {{"points", it->second.points}};
}

json handle_events(const std::string& id) {
    const auto snapshot = g_bridge.snapshot(id);
    std::lock_guard<std::mutex> lock(g_mutex);
    auto it = g_masters.find(id);
    if (it == g_masters.end()) {
        return {{"ok", false}, {"detail", "master not found"}};
    }
    if (snapshot.ok) {
        it->second.points = snapshot.points;
        it->second.events = snapshot.events;
        it->second.connected = snapshot.connected;
    }
    return {{"events", it->second.events}};
}

struct RequestContext {
    std::string body;
};

MHD_Response* make_response(const json& payload, unsigned int status_code) {
    const std::string body = payload.dump();
    MHD_Response* response = MHD_create_response_from_buffer(
        body.size(),
        const_cast<char*>(body.c_str()),
        MHD_RESPMEM_MUST_COPY
    );
    if (response == nullptr) {
        return nullptr;
    }
    MHD_add_response_header(response, "Content-Type", "application/json");
    MHD_add_response_header(response, "Access-Control-Allow-Origin", "*");
    MHD_add_response_header(response, "Access-Control-Allow-Headers", "content-type");
    MHD_add_response_header(response, "Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    return response;
}

MHD_Result send_json(MHD_Connection* connection, const json& payload, unsigned int status_code = MHD_HTTP_OK) {
    MHD_Response* response = make_response(payload, status_code);
    if (response == nullptr) {
        return MHD_NO;
    }
    const MHD_Result result = MHD_queue_response(connection, status_code, response);
    MHD_destroy_response(response);
    return result;
}

MHD_Result request_handler(
    void*,
    MHD_Connection* connection,
    const char* url,
    const char* method,
    const char*,
    const char* upload_data,
    size_t* upload_data_size,
    void** con_cls
) {
    const std::string http_method(method);
    if (http_method == "OPTIONS") {
        return send_json(connection, {{"ok", true}});
    }

    if (*con_cls == nullptr) {
        *con_cls = new RequestContext();
        return MHD_YES;
    }

    auto* context = static_cast<RequestContext*>(*con_cls);
    if (*upload_data_size != 0) {
        context->body.append(upload_data, *upload_data_size);
        *upload_data_size = 0;
        return MHD_YES;
    }

    json payload = json::object();
    if (!context->body.empty()) {
        try {
            payload = json::parse(context->body);
        } catch (...) {
            delete context;
            *con_cls = nullptr;
            return send_json(connection, {{"ok", false}, {"detail", "invalid JSON"}}, MHD_HTTP_BAD_REQUEST);
        }
    }

    const auto parts = split_path(url);
    json response;
    unsigned int status = MHD_HTTP_OK;

    if (http_method == "GET" && parts.size() == 1 && parts[0] == "health") {
        response = handle_health();
    } else if (http_method == "GET" && parts.size() == 1 && parts[0] == "runtime") {
        response = handle_runtime();
    } else if (parts.size() == 2 && parts[0] == "demo-outstation" && parts[1] == "status" && http_method == "GET") {
        response = {{"ok", true}, {"outstation", g_demo_outstation.status()}};
    } else if (parts.size() == 2 && parts[0] == "demo-outstation" && parts[1] == "start" && http_method == "POST") {
        response = handle_demo_outstation_start(payload);
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST;
    } else if (parts.size() == 2 && parts[0] == "demo-outstation" && parts[1] == "update" && http_method == "POST") {
        response = handle_demo_outstation_update();
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST;
    } else if (parts.size() == 2 && parts[0] == "demo-outstation" && parts[1] == "stop" && http_method == "POST") {
        response = handle_demo_outstation_stop();
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST;
    } else if (parts.size() == 2 && parts[0] == "demo-outstation" && parts[1] == "points" && http_method == "GET") {
        response = {{"ok", true}, {"outstation", g_demo_outstation.status()}};
    } else if (parts.size() == 2 && parts[0] == "demo-outstation" && parts[1] == "points" && http_method == "POST") {
        response = handle_demo_outstation_add_point(payload);
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST;
    } else if (parts.size() == 3 && parts[0] == "demo-outstation" && parts[1] == "points" && http_method == "PUT") {
        response = handle_demo_outstation_update_point(parts[2], payload);
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST;
    } else if (parts.size() == 3 && parts[0] == "demo-outstation" && parts[1] == "points" && http_method == "DELETE") {
        response = handle_demo_outstation_delete_point(parts[2]);
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_NOT_FOUND;
    } else if (parts.size() == 1 && parts[0] == "masters" && http_method == "GET") {
        response = handle_list_masters();
    } else if (parts.size() == 1 && parts[0] == "masters" && http_method == "POST") {
        response = handle_create_master(payload);
    } else if (parts.size() == 2 && parts[0] == "masters" && http_method == "GET") {
        response = handle_master_status(parts[1]);
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_NOT_FOUND;
    } else if (parts.size() == 3 && parts[0] == "masters" && parts[2] == "connect" && http_method == "POST") {
        response = handle_connect_master(parts[1]);
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST;
    } else if (parts.size() == 3 && parts[0] == "masters" && parts[2] == "disconnect" && http_method == "POST") {
        response = handle_disconnect_master(parts[1]);
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_NOT_FOUND;
    } else if (parts.size() == 4 && parts[0] == "masters" && parts[2] == "poll" && parts[3] == "integrity" && http_method == "POST") {
        response = handle_poll_master(parts[1]);
        status = response.value("ok", false) ? MHD_HTTP_OK : MHD_HTTP_NOT_IMPLEMENTED;
    } else if (parts.size() == 3 && parts[0] == "masters" && parts[2] == "points" && http_method == "GET") {
        response = handle_points(parts[1]);
        status = response.value("ok", true) ? MHD_HTTP_OK : MHD_HTTP_NOT_FOUND;
    } else if (parts.size() == 3 && parts[0] == "masters" && parts[2] == "events" && http_method == "GET") {
        response = handle_events(parts[1]);
        status = response.value("ok", true) ? MHD_HTTP_OK : MHD_HTTP_NOT_FOUND;
    } else {
        response = {{"ok", false}, {"detail", "not found"}};
        status = MHD_HTTP_NOT_FOUND;
    }

    delete context;
    *con_cls = nullptr;
    return send_json(connection, response, status);
}

void handle_signal(int) {
    g_running = false;
}

int main() {
    std::signal(SIGINT, handle_signal);
    std::signal(SIGTERM, handle_signal);

    const int port = env_int("DNP3_MASTER_RUNTIME_HTTP_PORT", 21200);
    MHD_Daemon* daemon = MHD_start_daemon(
        MHD_USE_INTERNAL_POLLING_THREAD,
        port,
        nullptr,
        nullptr,
        &request_handler,
        nullptr,
        MHD_OPTION_END
    );

    if (daemon == nullptr) {
        std::cerr << "failed to start dnp3-master-runtime on port " << port << std::endl;
        return 1;
    }

    std::cout << "dnp3-master-runtime listening on port " << port << std::endl;
    while (g_running) {
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
    }

    g_demo_outstation.stop();
    MHD_stop_daemon(daemon);
    g_bridge.shutdown();
    return 0;
}
