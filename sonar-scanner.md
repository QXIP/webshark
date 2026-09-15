```bash
╭─ pkhade@pkhade-mac (~/projects/webshark) master
╰─❯ JAVA_HOME=/opt/homebrew/opt/openjdk \
  sonar-scanner \
    -Dsonar.host.url=https://sonarqube.corp.redhat.com/ \
    -Dsonar.token=sqp_68f300e5a4663019e7a0759dcffb73c172c2398b
17:54:23.705 INFO  Scanner configuration file: /opt/homebrew/Cellar/sonar-scanner/8.1.0.6389/libexec/conf/sonar-scanner.properties
17:54:23.707 INFO  Project root configuration file: /Users/pkhade/projects/webshark/sonar-project.properties
17:54:23.716 INFO  SonarScanner CLI 8.1.0.6389
17:54:23.717 INFO  Mac OS X 26.6.2 aarch64
17:54:26.466 INFO  Communicating with SonarQube Server 2026.3.1.123439
17:54:26.467 INFO  JRE provisioning is disabled
17:54:26.467 INFO  Using the java executable '/opt/homebrew/opt/openjdk/bin/java' from JAVA_HOME
WARNING: Final field filename in class org.sonarsource.scanner.lib.internal.facade.forked.ResourceMetadata has been mutated reflectively by class com.google.gson.internal.bind.ReflectiveTypeAdapterFactory$2 in unnamed module @343f4d3d (file:/opt/homebrew/Cellar/sonar-scanner/8.1.0.6389/libexec/lib/sonar-scanner-cli-8.1.0.6389.jar)
WARNING: Use --enable-final-field-mutation=ALL-UNNAMED to avoid a warning
WARNING: Mutating final fields will be blocked in a future release unless final field mutation is enabled
17:54:27.085 INFO  Starting SonarScanner Engine...
17:54:27.085 INFO  Java 26.0.2.1 Homebrew (64-bit)
17:54:28.598 INFO  Load global settings
17:54:29.918 ERROR [stderr] WARNING: A terminally deprecated method in sun.misc.Unsafe has been called
17:54:29.918 ERROR [stderr] WARNING: sun.misc.Unsafe::arrayBaseOffset has been called by com.google.protobuf.UnsafeUtil$MemoryAccessor (file:/Users/pkhade/.sonar/cache/12feedb682d8b1103dd6fd4440acc5b293f13e5afa80b296618f03b48b8006e3/sonar-scanner-engine-enterprise-12.30.0.3186.jar)
17:54:29.919 ERROR [stderr] WARNING: Please consider reporting this to the maintainers of class com.google.protobuf.UnsafeUtil$MemoryAccessor
17:54:29.919 ERROR [stderr] WARNING: sun.misc.Unsafe::arrayBaseOffset will be removed in a future release
17:54:30.103 INFO  Load global settings (done) | time=1506ms
17:54:30.105 INFO  Server id: FCED8E45-AV7j1bbWEVhhZUiCsV1T
17:54:30.112 INFO  Loading required plugins
17:54:30.112 INFO  Load plugins index
17:54:30.439 INFO  Load plugins index (done) | time=326ms
17:54:30.439 INFO  Load/download plugins
17:55:29.592 INFO  Load/download plugins (done) | time=59151ms
17:55:29.649 INFO  Loaded core extensions: developer-scanner, server-common
17:55:30.099 INFO  Process project properties
17:55:30.107 INFO  Process project properties (done) | time=8ms
17:55:30.114 INFO  Project key: qxip-webshark
17:55:30.114 INFO  Base dir: /Users/pkhade/projects/webshark
17:55:30.114 INFO  Working dir: /Users/pkhade/projects/webshark/.scannerwork
17:55:30.119 INFO  Load project settings for component key: 'qxip-webshark'
17:55:30.427 INFO  Load project settings for component key: 'qxip-webshark' (done) | time=308ms
17:55:30.449 INFO  Load project branches
17:55:30.751 INFO  Load project branches (done) | time=301ms
17:55:30.752 INFO  Load branch configuration
17:55:30.753 INFO  Load branch configuration (done) | time=1ms
17:55:30.761 INFO  Load quality profiles
17:55:31.116 INFO  Load quality profiles (done) | time=354ms
17:55:31.144 INFO  Load active rules
17:55:31.908 INFO  Load active rules (done) | time=764ms
17:55:31.911 INFO  Load analysis cache
17:55:32.187 INFO  Load analysis cache (404) | time=276ms
17:55:33.218 INFO  Preprocessing files...
17:55:33.279 INFO  2 languages detected in 13 preprocessed files (done) | time=61ms
17:55:33.280 INFO  5 files ignored because of inclusion/exclusion patterns
17:55:33.280 INFO  0 files ignored because of scm ignore settings
17:55:33.281 INFO  Loading plugins for detected languages
17:55:33.281 INFO  Load/download plugins
-----------------------------------------------------
18:02:48.557 INFO  Load/download plugins (done) | time=435266ms
18:02:48.718 INFO  Load project repositories
18:02:49.074 INFO  Load project repositories (done) | time=356ms
18:02:49.083 INFO  Indexing files...
18:02:49.084 INFO  Project configuration:
18:02:49.084 INFO    Excluded sources: api/node_modules/**, api/test/**, web/**, api/test/**/*.js
18:02:49.084 INFO    Included tests: api/test/**/*.js
18:02:49.088 INFO  13 files indexed (done) | time=5ms
18:02:49.090 INFO  Quality profile for js: Sonar way
18:02:49.090 INFO  Quality profile for json: Sonar way
18:02:49.090 INFO  ------------- Run sensors on module webshark-ng
18:02:49.112 INFO  Load metrics repository
18:02:49.468 INFO  Load metrics repository (done) | time=355ms
18:02:49.555 INFO  Reflections took 59 ms to scan 1 urls, producing 26 keys and 266 values
18:02:49.751 ERROR [stderr] WARNING: A restricted method in java.lang.System has been called
18:02:49.752 ERROR [stderr] WARNING: java.lang.System::load has been called by org.treesitter.utils.NativeUtils in an unnamed module (file:/Users/pkhade/.sonar/cache/5d00549e2af5d3915a0703d4186a3681/sonar-iac-plugin.jar)
18:02:49.752 ERROR [stderr] WARNING: Use --enable-native-access=ALL-UNNAMED to avoid a warning for callers in this module
18:02:49.752 ERROR [stderr] WARNING: Restricted methods will be blocked in a future release unless native access is enabled
18:02:49.752 ERROR [stderr] 
18:02:51.684 INFO  Sensor HTML [web]
18:02:51.685 INFO  Sensor HTML [web] (done) | time=0ms
18:02:51.685 INFO  Sensor JasminFileCollectorSensor [jasmin]
18:02:51.685 INFO  Sensor JasminFileCollectorSensor [jasmin] (done) | time=0ms
18:02:51.685 INFO  Sensor IaC CloudFormation Sensor [iac]
18:02:51.691 INFO  There are no files to be analyzed for the CloudFormation language
18:02:51.691 INFO  Sensor IaC CloudFormation Sensor [iac] (done) | time=6ms
18:02:51.691 INFO  Sensor IaC cfn-lint report Sensor [iac]
18:02:51.691 INFO  Sensor IaC cfn-lint report Sensor [iac] (done) | time=0ms
18:02:51.692 INFO  Sensor IaC hadolint report Sensor [iac]
18:02:51.692 INFO  Sensor IaC hadolint report Sensor [iac] (done) | time=0ms
18:02:51.692 INFO  Sensor IaC Azure Resource Manager Sensor [iac]
18:02:51.692 INFO  There are no files to be analyzed for the Azure Resource Manager language
18:02:51.692 INFO  Sensor IaC Azure Resource Manager Sensor [iac] (done) | time=0ms
18:02:51.692 INFO  Sensor Java Config Sensor [iac]
18:02:51.693 INFO  There are no files to be analyzed for the Java language
18:02:51.693 INFO  Sensor Java Config Sensor [iac] (done) | time=0ms
18:02:51.693 INFO  Sensor IaC Docker Sensor [iac]
18:02:51.693 INFO  There are no files to be analyzed for the Docker language
18:02:51.693 INFO  Sensor IaC Docker Sensor [iac] (done) | time=0ms
18:02:51.694 INFO  Sensor IaC spectral report Sensor [iac]
18:02:51.694 INFO  Sensor IaC spectral report Sensor [iac] (done) | time=0ms
18:02:51.694 INFO  Sensor IaC GitHub Actions Sensor [iac]
18:02:51.694 INFO  There are no files to be analyzed for the GitHub Actions language
18:02:51.694 INFO  Sensor IaC GitHub Actions Sensor [iac] (done) | time=0ms
18:02:51.694 INFO  Sensor IaC actionlint report Sensor [iac]
18:02:51.694 INFO  Sensor IaC actionlint report Sensor [iac] (done) | time=0ms
18:02:51.694 INFO  Sensor IaC Azure Pipelines Sensor [iac]
18:02:51.695 INFO  There are no files to be analyzed for the Azure Pipelines language
18:02:51.695 INFO  Sensor IaC Azure Pipelines Sensor [iac] (done) | time=0ms
18:02:51.696 INFO  Sensor IaC Shell Sensor [iac]
18:02:51.696 INFO  There are no files to be analyzed for the Shell language
18:02:51.696 INFO  Sensor IaC Shell Sensor [iac] (done) | time=0ms
18:02:51.696 INFO  Sensor JavaScript/TypeScript/CSS analysis [javascript]
18:02:51.960 INFO  Detected os: Mac OS X arch: aarch64 alpine: false. Platform: DARWIN_ARM64
18:02:51.960 INFO  Deploy location /Users/pkhade/.sonar/js/node-runtime, tagetRuntime: /Users/pkhade/.sonar/js/node-runtime/node,  version: /Users/pkhade/.sonar/js/node-runtime/version.txt
18:02:55.859 INFO  Using embedded Node.js runtime.
18:02:55.859 INFO  Using Node.js executable: '/Users/pkhade/.sonar/js/node-runtime/node'.
18:02:56.783 INFO  Memory configuration: OS (16384 MB), Node.js (4288 MB).
18:02:56.788 INFO  gRPC analyze-project server listening on 127.0.0.1:56876
18:02:56.894 INFO  Plugin version: [12.4.0.40770]
18:02:57.673 INFO  Found 0 tsconfig.json file(s): []
18:02:58.534 INFO  11 source files to be analyzed
18:02:58.534 INFO  Analyzing 11 file(s) using default options [lib: lib.esnext.d.ts, lib.dom.d.ts]
18:02:58.535 INFO  11/11 source files have been analyzed
18:02:58.539 INFO  JasminAstConsumer done
18:02:58.539 INFO  Hit the cache for 0 out of 11
18:02:58.541 INFO  Miss the cache for 11 out of 11: ANALYSIS_MODE_INELIGIBLE [11/11]
18:02:58.541 INFO  Sensor JavaScript/TypeScript/CSS analysis [javascript] (done) | time=6845ms
18:02:58.541 INFO  Sensor IaC JSON Sensor [iac]
18:02:58.551 INFO  Sensor IaC JSON Sensor [iac] (done) | time=1ms
18:02:58.552 INFO  Sensor EnterpriseTextAndSecretsSensor [textenterprise]
18:02:58.561 INFO  Available processors: 8
18:02:58.561 INFO  Using 8 threads for analysis.
18:02:58.754 INFO  Start fetching files for the text and secrets analysis
18:02:58.808 INFO  Using Git CLI to retrieve dirty files
18:02:58.881 INFO  Retrieving language associated files and files included via "sonar.text.inclusions" that are tracked by git
18:02:58.881 INFO  Starting the text and secrets analysis
18:02:58.882 INFO  13 source files to be analyzed for the text and secrets analysis
18:02:58.905 INFO  13/13 source files have been analyzed for the text and secrets analysis
18:02:58.906 INFO  Start fetching files for the binary file analysis
18:02:58.906 INFO  There are no files to be analyzed for the binary file analysis
18:02:58.909 INFO  Sensor EnterpriseTextAndSecretsSensor [textenterprise] (done) | time=366ms
18:02:58.911 INFO  ------------- Run sensors on project
18:02:58.968 INFO  Sensor JsSecuritySensorV2 [jasmin]
18:02:58.993 INFO  6 file(s) will be analysed by SonarJasmin.
18:03:00.000 INFO  Analysis progress:  16% (1/6 files)
18:03:00.036 INFO  Analysis progress:  33% (2/6 files)
18:03:00.041 INFO  Analysis progress:  50% (3/6 files)
18:03:00.045 INFO  Analysis progress:  66% (4/6 files)
18:03:00.054 INFO  Analysis progress:  83% (5/6 files)
18:03:00.058 INFO  Sensor JsSecuritySensorV2 [jasmin] (done) | time=1090ms
18:03:00.058 INFO  Sensor JsArchitectureSensor [architecture]
18:03:00.066 INFO  Found 1 potential Udg file location(s) for "js" in "/Users/pkhade/projects/webshark/.scannerwork"
18:03:00.066 INFO  - /Users/pkhade/projects/webshark/.scannerwork/architecture/js
18:03:00.072 INFO  Architecture analysis is enabled with the following features: legacy, smells
18:03:00.074 INFO  * Protobuf reading starting | memory total=206 | free=129 | used=76 (MB)
18:03:00.074 INFO  * Reading SonarArchitecture UDG data from directory "/Users/pkhade/projects/webshark/.scannerwork/architecture/js"
18:03:00.128 INFO  * Files successfully loaded: "11" out of "11"
18:03:00.128 INFO  * Purging externals (components not scanned) from graphs
18:03:00.128 INFO  * Purging excluded nodes from graphs
18:03:00.129 INFO  * Protobuf reading complete | memory total=206 | free=118 | used=87 (MB)
18:03:00.137 INFO  * Build architecture.graph.js.file_graph.default_perspective hierarchy graph complete (filtered=false) | memory total=206 | free=115 | used=90 (MB)
18:03:00.142 INFO  * No intended architecture defined or detected, using an empty model
18:03:00.157 INFO  Sensor JsArchitectureSensor [architecture] (done) | time=98ms
18:03:00.157 INFO  Sensor Zero Coverage Sensor
18:03:00.163 INFO  Sensor Zero Coverage Sensor (done) | time=4ms
18:03:00.163 INFO  Sensor Architecture Telemetry [architecture]
18:03:00.163 INFO  Sensor Architecture Telemetry [architecture] (done) | time=0ms
18:03:00.163 INFO  ------------- Gather SCA dependencies on project
18:03:00.165 INFO  Dependency analysis skipped
18:03:00.166 INFO  SCM Publisher SCM provider for this project is: git
18:03:00.167 INFO  SCM Publisher 11 source files to be analyzed
18:03:00.511 INFO  SCM Publisher 9/11 source files have been analyzed (done) | time=343ms
18:03:00.511 WARN  Missing blame information for the following files:
18:03:00.511 WARN    * api/custom_module/sharkd_dict.js
18:03:00.511 WARN    * api/services/root.js
18:03:00.512 WARN  This may lead to missing/broken features in SonarQube
18:03:00.514 INFO  CPD Executor 2 files had no CPD blocks
18:03:00.515 INFO  CPD Executor Calculating CPD for 4 files
18:03:00.520 INFO  CPD Executor CPD calculation finished (done) | time=6ms
18:03:00.525 INFO  SCM revision ID 'fceb557befecdefb79c07ea55aa003648836a07f'
18:03:00.591 INFO  Load New Code definition
18:03:02.047 INFO  Load New Code definition (done) | time=1454ms
18:03:02.053 INFO  Analysis report generated in 1526ms, dir size=533.3 kB
18:03:02.085 INFO  Analysis report compressed in 31ms, zip size=155.5 kB
18:03:19.497 INFO  Analysis report uploaded in 17412ms
18:03:19.500 INFO  ANALYSIS SUCCESSFUL, you can find the results at: https://sonarqube.corp.redhat.com/dashboard?id=qxip-webshark
18:03:19.500 INFO  Note that you will be able to access the updated dashboard once the server has processed the submitted analysis report
18:03:19.500 INFO  More about the report processing at https://sonarqube.corp.redhat.com/api/ce/task?id=fd5dfc0a-1ec9-450b-b2a3-c006fd2ef5fd
18:03:19.657 INFO  Analysis total time: 7:50.008 s
18:03:19.658 INFO  SonarScanner Engine completed successfully
18:03:19.998 INFO  EXECUTION SUCCESS
18:03:20.001 INFO  Total time: 8:56.295s
```