import java.net.URI

plugins {
    id("com.android.application")
}

val genesisUrl = providers.gradleProperty("genesisUrl")
    .orElse("https://genesiscalendar.ru/")
    .get()
val genesisUri = URI(genesisUrl)
require(genesisUri.scheme == "https" && !genesisUri.host.isNullOrBlank()) {
    "-PgenesisUrl must be an absolute HTTPS URL"
}

android {
    namespace = "ru.genesis.calendar"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "ru.genesis.calendar"
        minSdk = 23
        targetSdk = 36
        versionCode = 2
        versionName = "1.1.0"

        manifestPlaceholders["genesisHost"] = genesisUri.host
        resValue("string", "launch_url", genesisUrl)
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        resValues = true
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.3")
}
