#!/bin/sh

set -x

## GeoIP
# apt-get update && apt-get install -y libmaxminddb-dev

# Update wireshark sources
git pull
#git reset --hard 640ded8e1d45ec3ee8594c385b1045cbaa0042a0   ## tested with this hash

# Integrate sharkd
patch -p1 < ../sharkd/sharkd.patch
patch -p1 < ../sharkd/sharkd_opt_memory.patch ## optional
cp ../sharkd/*.[ch] ./

mkdir build
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

make -j8
cd run

# Generate tarball in /out directory
strip sharkd
mkdir -p ./usr/local/bin/ ./usr/local/share/wireshark/
cp sharkd ./usr/local/bin/
# cp mmdbresolve ./usr/local/bin/
cp colorfilters ./usr/local/share/wireshark/
tar -vczf /out/sharkd.tar.gz ./usr
