import java.net.URI

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

val genesisUrl = providers.gradleProperty("genesisUrl")
    .orElse("https://genesiscalendar.com/")
    .get()
val genesisUri = URI(genesisUrl)
require(genesisUri.scheme == "https" && !genesisUri.host.isNullOrBlank()) {
    "-PgenesisUrl must be an absolute HTTPS URL"
}
require(genesisUri.rawPath in listOf("", "/") && genesisUri.rawQuery == null && genesisUri.rawFragment == null && genesisUri.userInfo == null) {
    "-PgenesisUrl must be an HTTPS origin without a path, query, or credentials"
}
val genesisOrigin = "https://${genesisUri.authority}"
val releaseStore = providers.environmentVariable("GENESIS_ANDROID_SIGNING_STORE").orNull
val releaseStorePassword = providers.environmentVariable("GENESIS_ANDROID_SIGNING_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("GENESIS_ANDROID_SIGNING_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("GENESIS_ANDROID_SIGNING_KEY_PASSWORD").orNull
val yandexClientId = providers.environmentVariable("GENESIS_YANDEX_CLIENT_ID").orElse("").get().trim()
require(yandexClientId.isEmpty() || yandexClientId.matches(Regex("[A-Za-z0-9_-]{16,128}"))) {
    "GENESIS_YANDEX_CLIENT_ID has an invalid format"
}
val releaseSigningReady = listOf(releaseStore, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
    .all { !it.isNullOrBlank() }
val debugApplicationSuffix = providers.gradleProperty("genesisDebugApplicationIdSuffix").orElse(".debug").get()
require(debugApplicationSuffix.matches(Regex("(?:\\.[a-z][a-z0-9]*)*\\.debug"))) {
    "Debug application ID must end in .debug and remain separate from production"
}

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
        versionCode = 100
        versionName = "2.9.5"
        buildConfigField("boolean", "PLAY_DISTRIBUTION", "false")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        manifestPlaceholders["genesisHost"] = genesisUri.host
        manifestPlaceholders["YANDEX_CLIENT_ID"] = yandexClientId
        buildConfigField("String", "YANDEX_CLIENT_ID", "\"$yandexClientId\"")
        buildConfigField("String", "GENESIS_ORIGIN", "\"$genesisOrigin\"")
        buildConfigField("String", "GENESIS_HOST", "\"${genesisUri.host}\"")
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
            applicationIdSuffix = debugApplicationSuffix
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
        create("play") {
            initWith(getByName("release"))
            buildConfigField("boolean", "PLAY_DISTRIBUTION", "true")
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
    sourceSets.getByName("androidTest").assets.srcDir("src/test/resources")
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
    from(rootProject.file("../app")) {
        include("translations.el.a.json", "translations.el.b.json", "translations.de.json", "translations.de.b.json", "translations.fr.json", "translations.fr.b.json",
            "translations.es.json", "translations.it.json", "translations.pt.json",
            "translations.pl.json", "translations.sr.a.json", "translations.sr.b.json",
            "translations.uk.a.json", "translations.uk.b.json",
            "translations.zh.json", "translations.tr.json", "translations.ja.json", "translations.ja.b.json")
        into("i18n")
    }
    from(rootProject.file("../app/curated-translations.en.json")) { into("i18n") }
    from(rootProject.file("../app/native-affairs-translations.json")) { into("i18n") }
    from(rootProject.file("../app/native-data-export-translations.json")) { into("i18n") }
    from(rootProject.file("../app/native-data-import-translations.json")) { into("i18n") }
    from(rootProject.file("../app/native-bulk-translations.json")) { into("i18n") }
    from(rootProject.file("../app/native-template-translations.json")) { into("i18n") }
    from(rootProject.file("../app/native-template-labels.json")) { into("i18n") }
    from(rootProject.file("../app/native-automations-translations.json")) { into("i18n") }
    from(rootProject.file("../app/native-saved-views-translations.json")) { into("i18n") }
    from(rootProject.file("../app/custom-field-recovery-translations.json")) { into("i18n") }
    from(rootProject.file("../app/planning-translations.json")) { into("i18n") }
    from(rootProject.file("../app/daily-advice-copy.json")) { into("i18n") }
    from(rootProject.file("../app/native-mobile-design-translations.json")) { into("i18n") }
    from(rootProject.file("../app/daily-advice-affinity.json")) { into("catalogs") }
    from(rootProject.file("../app/daily-advice-topics.json")) { into("catalogs") }
    from(rootProject.file("../app/sprint-report-translations.json")) { into("i18n") }
    from(rootProject.file("../app/workflow-draft-translations.json")) { into("i18n") }
    from(rootProject.file("../app/workflow-translations.json")) { into("i18n") }
    from(rootProject.file("../app/habit-report-translations.json")) { into("i18n") }
    from(rootProject.file("../app/emoji-catalog.json")) { into("i18n") }
    from(rootProject.file("../app/emoji-full-catalog.json")) { into("i18n") }
    from(rootProject.file("../app")) { include("calendar-days.*.json"); into("i18n") }
    from(rootProject.file("../app/stoicheion.en.json")) { into("i18n") }
    from(rootProject.file("../app/stoicheion-restoration-content.json")) { into("catalogs") }
    from(rootProject.file("../app/stoicheion-restoration-ui.json")) { into("catalogs") }
    from(rootProject.file("../app/catalog-translations")) {
        include("*.json")
        into("i18n/catalog-translations")
    }
    from(rootProject.file("../app/ui-translations")) { include("*.json"); into("i18n/ui-translations") }
    from(rootProject.file("../app/shared-work-translations")) { include("*.json"); into("i18n/shared-work-translations") }
    from(rootProject.file("../app/year-translations")) {
        include("*.json")
        into("i18n/year-translations")
    }
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
    implementation("androidx.core:core:1.18.0")
    implementation("androidx.browser:browser:1.10.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation(libs.room.runtime)
    ksp(libs.room.compiler)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.work.runtime)
    implementation("androidx.datastore:datastore-preferences:1.2.1")
    implementation("androidx.credentials:credentials:1.6.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0")
    // 1.2.1 carries Kotlin 2.4 metadata; 1.1.1 retains compatibility with AGP's Kotlin 2.2.
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("com.google.android.gms:play-services-auth:21.6.0")
    implementation("com.google.android.play:app-update-ktx:2.1.0")
    implementation("com.yandex.android:authsdk:3.1.3")
    // YandexAuthLoginOptions references this annotation; R8 needs it in release builds.
    implementation("org.jetbrains.kotlin:kotlin-parcelize-runtime:2.2.10")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
    androidTestImplementation(composeBom)
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4-accessibility")
}
