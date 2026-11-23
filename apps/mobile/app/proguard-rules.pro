# Pluto Release R8 / ProGuard Rules

# Preserve Kotlin metadata needed by Moshi reflection & Retrofit suspend calls
-keep class kotlin.Metadata { *; }

# Preserve Firebase Firestore model classes & zero-arg constructors for .toObject(...)
-keepattributes Signature,InnerClasses,EnclosingMethod,RuntimeVisibleAnnotations
-keep @com.google.firebase.firestore.IgnoreExtraProperties class com.pluto.app.data.remote.cloud.** { *; }
-keepclassmembers class com.pluto.app.data.remote.cloud.** {
    @com.google.firebase.firestore.DocumentId <fields>;
    @com.google.firebase.firestore.ServerTimestamp <fields>;
    <init>(...);
}

# Preserve Retrofit service contracts & Moshi DTOs / generated JsonAdapters
-keep interface com.pluto.app.data.remote.exchange.ExchangeRateApiService { *; }
-keep class com.pluto.app.data.remote.exchange.ExchangeRateResponseDto { *; }
-keep class com.pluto.app.data.remote.exchange.*JsonAdapter { *; }

# Preserve Type-Safe Navigation @Serializable routes & serializers
-keep @kotlinx.serialization.Serializable class com.pluto.app.ui.navigation.** { *; }
-keepclassmembers class com.pluto.app.ui.navigation.** {
    *** Companion;
    *** serializer(...);
}

# Preserve Room Database & WorkManager Workers instantiated via reflection
-keep class * extends androidx.room.RoomDatabase
-keep class com.pluto.app.data.worker.ExchangeRateSyncWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

# Strip verbose/debug Android Log calls in release builds (preserve warnings/errors)
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
