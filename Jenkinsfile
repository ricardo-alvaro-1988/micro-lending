pipeline {
    agent any
    options {
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        buildDiscarder(logRotator(numToKeepStr: '15'))
        timeout(time: 20, unit: 'MINUTES')
        timestamps()
    }
    triggers { pollSCM('H/2 * * * *') }
    stages {
        stage('Checkout staging') {
            steps {
                deleteDir()
                script {
                    def revision = checkout scm
                    if (revision.GIT_BRANCH != 'origin/staging') {
                        error('Only origin/staging may deploy this test site')
                    }
                }
                sh '''
                    set -eu
                    test "$(git rev-parse HEAD)" = "$(git rev-parse refs/remotes/origin/staging)"
                '''
            }
        }
        stage('Build') {
            steps {
                sh '''
                    set -eu
                    dotnet publish backend/MicroLending.Api.csproj -c Release -o .pipeline-artifacts/api
                    cd frontend
                    npm ci --no-audit --no-fund
                    npm run build
                    cd ..
                    cp -R frontend/dist .pipeline-artifacts/web
                    git rev-parse HEAD > .pipeline-artifacts/commit.txt
                '''
            }
        }
        stage('Deploy test site') {
            steps { sh 'sudo -n /usr/local/bin/deploy-microlending-staging' }
        }
        stage('Verify HTTPS') {
            steps {
                sh '''
                    set -eu
                    curl --fail --silent --show-error https://lending.enovasoftware.com/ -o /dev/null
                    test "$(curl --silent --show-error -o /dev/null -w '%{http_code}' https://lending.enovasoftware.com/api/auth/me)" = "401"
                '''
            }
        }
    }
}
