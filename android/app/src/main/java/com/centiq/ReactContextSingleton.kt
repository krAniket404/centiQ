package com.centiq // REPLACE WITH YOUR PACKAGE NAME

import com.facebook.react.bridge.ReactApplicationContext

object ReactContextSingleton {
    @Volatile
    var reactContext: ReactApplicationContext? = null
}