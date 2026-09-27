import java.net.URI

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

val genesisUrl = providers.gradleProperty("genesisUrl")
    .orElse("https://genesiscalendar.ru/")
    .get()
val genesisUri = URI(genesisUrl)
require(genesisUri.scheme == "https" && !genesisUri.host.isNullOrBlank()) {
    "-PgenesisUrl must be an absolute HTTPS URL"
}
val releaseStore = providers.environmentVariable("GENESIS_ANDROID_SIGNING_STORE").orNull
val releaseStorePassword = providers.environmentVariable("GENESIS_ANDROID_SIGNING_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("GENESIS_ANDROID_SIGNING_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("GENESIS_ANDROID_SIGNING_KEY_PASSWORD").orNull
val releaseSigningReady = listOf(releaseStore, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
    .all { !it.isNullOrBlank() }

android {
    namespace = "ru.genesis.calendar"
    compileSdk {
        version = release(37) {
            minorApiLevel = 2
        }
    }

    defaultConfig {
        applicationId = "ru.genesis.calendar"
        minSdk = 26
        targetSdk = 37
        versionCode = 30
        versionName = "2.2.7"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        manifestPlaceholders["genesisHost"] = genesisUri.host
        resValue("string", "launch_url", genesisUrl)
        resValue("string", "app_name", "GENESIS")
    }

    signingConfigs {
        if (releaseSigningReady) create("genesisRelease") {
            storeFile = file(requireNotNull(releaseStore))
            storePassword = releaseStorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            resValue("string", "app_name", "GENESIS Alpha")
        }
        release {
            if (releaseSigningReady) signingConfig = signingConfigs.getByName("genesisRelease")
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
        buildConfig = true
        compose = true
        resValues = true
    }
}

// Original byte copies in generated assets; no tracked duplicate or image conversion.
abstract class GenesisAssetsTask : Sync() {
    @get:OutputDirectory abstract val assetsDirectory: DirectoryProperty
}
val genesisAssets = tasks.register<GenesisAssetsTask>("genesisAssets") {
    assetsDirectory.set(layout.buildDirectory.dir("generated/genesisAssets"))
    from(rootProject.file("../public")) {
        include("icons/**", "weekday-art/**", "day-art-v1/**", "month-art-v4/**",
            "theokyklos-art/**", "theokyklos-symbols/**", "stoicheion-cards/**",
            "achievement-art/**", "habit-ranks/**", "habit-reward-art/**", "hero-path/**",
            "calendar-art/**", "genesis-hero.png", "month-frieze-v2.png")
    }
    from(rootProject.file("../app/translations.en.json")) { into("i18n") }
    from(rootProject.file("../app/curated-translations.en.json")) { into("i18n") }
    from(rootProject.file("../app/calendar-days.en.json")) { into("i18n") }
    from(rootProject.file("../app/stoicheion.en.json")) { into("i18n") }
    into(assetsDirectory.dir("originals"))
}
androidComponents.onVariants { variant ->
    variant.sources.assets?.addGeneratedSourceDirectory(genesisAssets, GenesisAssetsTask::assetsDirectory)
}
ksp { arg("room.schemaLocation", "$projectDir/schemas") }
tasks.withType<JavaCompile>().configureEach { options.encoding = "UTF-8" }

dependencies {
    val composeBom = platform(libs.compose.bom)

    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.browser:browser:1.10.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation(libs.room.runtime)
    ksp(libs.room.compiler)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.work.runtime)
    implementation("androidx.datastore:datastore-preferences:1.2.0")
    implementation("androidx.credentials:credentials:1.6.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0")
    // 1.2.1 carries Kotlin 2.4 metadata; 1.1.1 retains compatibility with AGP's Kotlin 2.2.
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("com.google.android.gms:play-services-auth:21.6.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
    androidTestImplementation(composeBom)
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
