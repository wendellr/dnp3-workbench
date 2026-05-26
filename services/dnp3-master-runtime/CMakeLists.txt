cmake_minimum_required(VERSION 3.16)

project(dnp3_master_runtime LANGUAGES CXX)

option(ENABLE_OPENDNP3 "Enable OpenDNP3 master integration" OFF)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(PkgConfig REQUIRED)
pkg_check_modules(MICROHTTPD REQUIRED libmicrohttpd)
find_package(nlohmann_json REQUIRED)

add_executable(dnp3-master-runtime
    src/demo_outstation.cpp
    src/main.cpp
    src/opendnp3_master_bridge.cpp
)

if(ENABLE_OPENDNP3)
    find_path(OPENDNP3_INCLUDE_DIR NAMES opendnp3/DNP3Manager.h)
    find_library(OPENDNP3_LIB NAMES opendnp3)

    if(NOT OPENDNP3_INCLUDE_DIR OR NOT OPENDNP3_LIB)
        message(FATAL_ERROR "ENABLE_OPENDNP3=ON, but OpenDNP3 headers/libs were not found.")
    endif()

    target_compile_definitions(dnp3-master-runtime PRIVATE OPENDNP3_ENABLED=1)
    target_include_directories(dnp3-master-runtime PRIVATE ${OPENDNP3_INCLUDE_DIR})
    target_link_libraries(dnp3-master-runtime PRIVATE ${OPENDNP3_LIB})
else()
    target_compile_definitions(dnp3-master-runtime PRIVATE OPENDNP3_ENABLED=0)
endif()

target_include_directories(dnp3-master-runtime PRIVATE ${MICROHTTPD_INCLUDE_DIRS})
target_link_directories(dnp3-master-runtime PRIVATE ${MICROHTTPD_LIBRARY_DIRS})
target_link_libraries(dnp3-master-runtime PRIVATE ${MICROHTTPD_LIBRARIES} nlohmann_json::nlohmann_json)
target_compile_options(dnp3-master-runtime PRIVATE ${MICROHTTPD_CFLAGS_OTHER})
