package com.pluto.app.data.util

import java.util.LinkedHashMap

/**
 * Thread-safe In-Memory Least-Recently-Used (LRU) Cache.
 *
 * Implements the standard LRU algorithm using access-order [LinkedHashMap] with synchronized access.
 * Runs seamlessly on JVM unit tests and Android runtimes without requiring android.util.LruCache stubs.
 */
class LruMemoryCache<K : Any, V : Any>(private val maxSize: Int) {

  private val map = object : LinkedHashMap<K, V>(16, 0.75f, true) {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<K, V>?): Boolean {
      return size > maxSize
    }
  }

  @Synchronized
  fun get(key: K): V? {
    return map[key]
  }

  @Synchronized
  fun put(key: K, value: V) {
    map[key] = value
  }

  @Synchronized
  fun remove(key: K): V? {
    return map.remove(key)
  }

  @Synchronized
  fun evictAll() {
    map.clear()
  }

  @Synchronized
  fun size(): Int = map.size
}
