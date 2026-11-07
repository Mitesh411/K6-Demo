pipeline {
    agent any

    parameters {
        choice(name: 'TEST_TYPE', choices: ['all', 'backend_k6', 'frontend_sitespeed'], description: 'Select which performance test to run')
        string(name: 'TEST_RUN_ID', defaultValue: '', description: 'Custom run ID for backend test (blank for auto-generated timestamp)')
        string(name: 'TARGET_API_URL', defaultValue: 'http://sample-app:8080', description: 'Base URL for backend API load testing')
        string(name: 'TARGET_WEB_URL', defaultValue: 'http://sample-app:8080/', description: 'URL for frontend sitespeed.io audit')
        choice(name: 'LOAD_PROFILE', choices: ['custom', 'smoke', 'load', 'stress', 'spike', 'soak', 'breakpoint'], description: 'k6 load profile (k6/config/scenarios.js). "custom" uses K6_VUS and K6_DURATION.')
        string(name: 'K6_VUS', defaultValue: '10', description: 'Concurrent Virtual Users for k6 (LOAD_PROFILE=custom only)')
        string(name: 'K6_DURATION', defaultValue: '30s', description: 'Duration of k6 load test (LOAD_PROFILE=custom only)')
    }

    environment {
        INFLUXDB_HOST = 'http://influxdb:8086'
    }

    stages {
        stage('Initialize Run') {
            steps {
                script {
                    if (!params.TEST_RUN_ID) {
                        env.RUN_ID = "run_${System.currentTimeMillis()}"
                    } else {
                        env.RUN_ID = params.TEST_RUN_ID
                    }
                    echo "Starting Performance Pipeline with Run ID: ${env.RUN_ID}"
                }
            }
        }

        stage('Backend API Load Testing (k6)') {
            when {
                expression { params.TEST_TYPE == 'all' || params.TEST_TYPE == 'backend_k6' }
            }
            steps {
                echo "Running k6 backend load test (profile: ${params.LOAD_PROFILE})..."
                script {
                    // "custom" keeps the original VUs/duration behaviour; smoke SLO thresholds still apply.
                    def isCustom = params.LOAD_PROFILE == 'custom'
                    def k6Profile = isCustom ? 'smoke' : params.LOAD_PROFILE
                    def loadArgs = isCustom ? "--vus ${params.K6_VUS} --duration ${params.K6_DURATION}" : ''
                    // k6 exits non-zero when an SLO threshold is breached, which fails this stage.
                    sh """
                        docker compose run --rm \
                          -e TEST_RUN_ID="${env.RUN_ID}" \
                          -e LOAD_PROFILE="${k6Profile}" \
                          -e TARGET_HOST="${params.TARGET_API_URL}" \
                          -e INFLUXDB_HOST="${env.INFLUXDB_HOST}" \
                          -e K6_OUT="influxdb=${env.INFLUXDB_HOST}/k6" \
                          k6 run ${loadArgs} /scripts/k6/load-test.js
                    """
                }
            }
        }

        stage('Frontend Website Audit (sitespeed.io)') {
            when {
                expression { params.TEST_TYPE == 'all' || params.TEST_TYPE == 'frontend_sitespeed' }
            }
            steps {
                echo "Running sitespeed.io frontend audit..."
                sh """
                    ./scripts/run-sitespeed.sh "${params.TARGET_WEB_URL}"
                """
            }
        }

        stage('Publish Results Notice') {
            steps {
                echo "=========================================================="
                echo "Performance tests completed successfully!"
                echo "View the real-time Grafana dashboard at: http://localhost:3000"
                echo "Backend Run ID: ${env.RUN_ID}"
                echo "=========================================================="
            }
        }
    }

    post {
        always {
            cleanWs deleteDirs: true, notFailBuild: true
        }
    }
}
