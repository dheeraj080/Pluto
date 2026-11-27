package com.pluto.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pluto.app.domain.model.Currency
import com.pluto.app.domain.model.HomeLayoutPresets
import com.pluto.app.domain.model.HomeModuleConfig
import com.pluto.app.domain.model.UserPersona
import com.pluto.app.domain.model.UserSettings
import com.pluto.app.domain.repository.UserSettingsRepository
import java.math.BigDecimal
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class MainViewModel(
  private val userSettingsRepository: UserSettingsRepository
) : ViewModel() {

  val userSettings: StateFlow<UserSettings> = userSettingsRepository.observeSettings()
    .stateIn(
      scope = viewModelScope,
      started = SharingStarted.WhileSubscribed(5000),
      initialValue = UserSettings()
    )

  fun updateHomeCurrency(currency: Currency) {
    viewModelScope.launch {
      userSettingsRepository.updateHomeCurrency(currency)
    }
  }

  fun updateDestinationCurrency(currency: Currency) {
    viewModelScope.launch {
      userSettingsRepository.updateDestinationCurrency(currency)
    }
  }

  fun updateSpendingCaps(dailyCap: BigDecimal?, monthlyCap: BigDecimal?) {
    viewModelScope.launch {
      userSettingsRepository.updateSpendingCaps(dailyCap, monthlyCap)
    }
  }

  fun updateWarningThreshold(threshold: BigDecimal?, notificationsEnabled: Boolean = true) {
    viewModelScope.launch {
      userSettingsRepository.updateWarningThreshold(threshold, notificationsEnabled)
    }
  }

  fun updateThemeMode(themeMode: com.pluto.app.domain.model.ThemeMode) {
    viewModelScope.launch {
      userSettingsRepository.updateThemeMode(themeMode)
    }
  }

  fun updateBiometricLock(enabled: Boolean, timeoutMinutes: Int = 1) {
    viewModelScope.launch {
      userSettingsRepository.updateBiometricLock(enabled, timeoutMinutes)
    }
  }

  fun updatePrivacyMode(enabled: Boolean) {
    viewModelScope.launch {
      userSettingsRepository.updatePrivacyMode(enabled)
    }
  }

  fun updateHomeTimeZone(timeZoneId: String?) {
    viewModelScope.launch {
      userSettingsRepository.updateHomeTimeZone(timeZoneId)
    }
  }

  fun updateHomeModules(homeModules: List<HomeModuleConfig>) {
    viewModelScope.launch {
      userSettingsRepository.updateHomeModules(homeModules)
    }
  }

  fun applyPersonaPreset(persona: UserPersona) {
    viewModelScope.launch {
      val current = userSettingsRepository.getSettings()
      userSettingsRepository.updateSettings(
        current.copy(
          persona = persona,
          homeModules = HomeLayoutPresets.forPersona(persona)
        )
      )
    }
  }


  fun seedDummyData(database: com.pluto.app.data.local.AppDatabase) {
    viewModelScope.launch {
      com.pluto.app.data.util.SampleDataSeeder.seedSampleData(database, userSettingsRepository)
    }
  }

  fun resetOnboarding() {
    viewModelScope.launch {
      val current = userSettingsRepository.getSettings()
      userSettingsRepository.updateSettings(
        current.copy(isOnboardingCompleted = false)
      )
    }
  }

  fun completeOnboarding(currency: Currency, destinationCurrency: Currency = Currency.EUR) {
    viewModelScope.launch {
      val current = userSettingsRepository.getSettings()
      userSettingsRepository.updateSettings(
        current.copy(
          homeCurrency = currency,
          destinationCurrency = destinationCurrency,
          isOnboardingCompleted = true
        )
      )
    }
  }

  companion object {
    fun provideFactory(repository: UserSettingsRepository): ViewModelProvider.Factory =
      object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
          return MainViewModel(repository) as T
        }
      }
  }
}
