import java.time.Duration
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.google.services)
}

val envFile = rootProject.file(".env")
val envExampleFile = rootProject.file(".env.example")
val envProps = Properties().apply {
    if (envExampleFile.exists()) {
        envExampleFile.inputStream().use { load(it) }
    }
    if (envFile.exists()) {
        envFile.inputStream().use { load(it) }
    }
}

// Release signing is supplied by the build environment, never by a committed
// keystore or hardcoded password. Locally these can live in ~/.gradle/gradle.properties.
val releaseStoreFile = providers.gradleProperty("pluto.release.storeFile").orNull
    ?: System.getenv("PLUTO_RELEASE_STORE_FILE")
val releaseStorePassword = providers.gradleProperty("pluto.release.storePassword").orNull
    ?: System.getenv("PLUTO_RELEASE_STORE_PASSWORD")
val releaseKeyAlias = providers.gradleProperty("pluto.release.keyAlias").orNull
    ?: System.getenv("PLUTO_RELEASE_KEY_ALIAS")
val releaseKeyPassword = providers.gradleProperty("pluto.release.keyPassword").orNull
    ?: System.getenv("PLUTO_RELEASE_KEY_PASSWORD")
val hasReleaseSigning = listOf(
    releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword
).all { !it.isNullOrBlank() }

// These two tests talk to the Firebase Auth and Firestore emulators on
// 127.0.0.1:8085/9099. Keep them out of the hermetic unit-test task and run
// them explicitly with `testEmulator` once the emulators are up.
val emulatorTestClasses = listOf(
    "com.pluto.app.data.remote.cloud.FirestoreSyncRepositoryRuleTest",
    "com.pluto.app.data.remote.cloud.OfflineModeAndCloudMergeTest",
)

android {
    namespace = "com.pluto.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.pluto.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        val isDevMode = envProps.getProperty("DEV_MODE", "false").toBoolean()
        val isSeedSampleData = envProps.getProperty("SEED_SAMPLE_DATA", "false").toBoolean()
        buildConfigField("boolean", "DEV_MODE", isDevMode.toString())
        buildConfigField("boolean", "SEED_SAMPLE_DATA", isSeedSampleData.toString())
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        // Debug uses Android's own default debug keystore. The old project's
        // custom debugConfig pointed at a debug.keystore that was never checked in.
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
}

tasks.withType<Test> {
    failFast = true
    timeout.set(Duration.ofMinutes(2))
    testLogging {
        events("passed", "failed", "skipped")
    }
    if (name != "testEmulator") {
        filter {
            emulatorTestClasses.forEach { excludeTestsMatching(it) }
        }
    }
}

tasks.register<Test>("testEmulator") {
    description = "Runs the Firestore/Auth emulator-backed tests (emulators must already be running)."
    group = "verification"
    val unitTest = tasks.named<Test>("testDebugUnitTest").get()
    testClassesDirs = unitTest.testClassesDirs
    classpath = unitTest.classpath
    // Gradle 9 removed the convention that gave custom Test tasks the default
    // test source set's inputs, so inherit them explicitly and depend on the
    // unit-test compilation tasks without running the hermetic tests themselves.
    dependsOn(tasks.matching { it.name.startsWith("compile") && it.name.contains("UnitTest") })
    filter {
        emulatorTestClasses.forEach { includeTestsMatching(it) }
    }
}

tasks.matching {
    it.name.startsWith("assembleRelease") || it.name.startsWith("bundleRelease")
}.configureEach {
    doFirst {
        check(hasReleaseSigning) {
            "Release signing is not configured. Set PLUTO_RELEASE_STORE_FILE, " +
                "PLUTO_RELEASE_STORE_PASSWORD, PLUTO_RELEASE_KEY_ALIAS and " +
                "PLUTO_RELEASE_KEY_PASSWORD (or the matching pluto.release.* Gradle properties)."
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material3.adaptive.navigation.suite)
    implementation(libs.androidx.material3.windowsize)
    implementation(libs.androidx.compose.material3.adaptive)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.biometric)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.auth)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services)
    implementation(libs.googleid)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.sqlite)
    implementation(libs.androidx.sqlite.framework)

    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.moshi)
    implementation(libs.moshi.kotlin)
    ksp(libs.moshi.kotlin.codegen)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)

    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.androidx.compose.ui.test.junit4)

    debugImplementation(libs.androidx.ui.tooling)
}
