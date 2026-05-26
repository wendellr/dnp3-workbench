FROM debian:bookworm-slim AS build

WORKDIR /app

ARG ENABLE_OPENDNP3=OFF

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    git \
    pkg-config \
    libmicrohttpd-dev \
    nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN if [ "${ENABLE_OPENDNP3}" = "ON" ]; then \
    git clone --depth 1 --branch 3.1.2 https://github.com/dnp3/opendnp3.git /tmp/opendnp3 && \
    cmake -S /tmp/opendnp3 -B /tmp/opendnp3/build \
      -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SHARED_LIBS=OFF \
      -DOPENDNP3_BUILD_EXAMPLES=OFF \
      -DOPENDNP3_BUILD_TESTS=OFF && \
    cmake --build /tmp/opendnp3/build -j"$(nproc)" && \
    cmake --install /tmp/opendnp3/build --prefix /usr/local && \
    rm -rf /tmp/opendnp3; \
fi

COPY CMakeLists.txt ./
COPY src ./src

RUN cmake -S . -B build -DENABLE_OPENDNP3=${ENABLE_OPENDNP3} && \
    cmake --build build -j"$(nproc)"

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libmicrohttpd12 \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/build/dnp3-master-runtime /usr/local/bin/dnp3-master-runtime
COPY --from=build /usr/local/lib/ /usr/local/lib/

RUN ldconfig || true

EXPOSE 21200

CMD ["/usr/local/bin/dnp3-master-runtime"]
