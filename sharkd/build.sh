#!/bin/sh

set -ex

# Optional GeoIP:
# apt-get update && apt-get install -y libmaxminddb-dev

# Do not `git pull` here — Docker pins a Wireshark tag/commit for reproducible builds (#52).

mkdir -p build
cd build

# Compile sharkd static, and without optional libraries
cmake -DCMAKE_BUILD_TYPE=RELEASE -DCMAKE_C_FLAGS_RELEASE="-O3 -pipe" \
	-DENABLE_STATIC=ON -DENABLE_PLUGINS=OFF -DDISABLE_WERROR=ON \
	-DBUILD_wireshark=OFF -DBUILD_tshark=OFF -DBUILD_sharkd=ON -DBUILD_dumpcap=OFF -DBUILD_capinfos=OFF \
	-DBUILD_captype=OFF -DBUILD_randpkt=OFF -DBUILD_dftest=OFF -DBUILD_editcap=OFF -DBUILD_mergecap=OFF \
	-DBUILD_reordercap=OFF -DBUILD_text2pcap=OFF -DBUILD_fuzzshark=OFF \
	-DBUILD_androiddump=OFF -DBUILD_randpktdump=OFF -DBUILD_udpdump=OFF \
	-DENABLE_PCAP=OFF -DENABLE_GNUTLS=OFF \
	../

# Limit parallelism to reduce OOM aborts during dissectors compile (#52).
JOBS="${SHARKD_BUILD_JOBS:-}"
if [ -z "$JOBS" ]; then
	if command -v nproc >/dev/null 2>&1; then
		JOBS="$(nproc)"
		# Cap default parallelism; full -j$(nproc) often OOMs in small builders.
		if [ "$JOBS" -gt 4 ]; then
			JOBS=4
		fi
	else
		JOBS=2
	fi
fi

make -j"$JOBS"
cd run

# Generate tarball in /out directory
strip sharkd
mkdir -p ./usr/local/bin/ ./usr/local/share/wireshark/
cp sharkd ./usr/local/bin/
cp colorfilters ./usr/local/share/wireshark/
tar -vczf /out/sharkd.tar.gz ./usr
