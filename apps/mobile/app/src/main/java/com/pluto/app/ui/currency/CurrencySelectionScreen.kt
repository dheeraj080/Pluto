package com.pluto.app.ui.currency

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pluto.app.domain.model.Currency
import com.pluto.app.ui.components.CurrencyRow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CurrencySelectionScreen(
  title: String,
  selectedCurrency: Currency,
  onCurrencySelected: (Currency) -> Unit,
  onBackClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  var searchQuery by rememberSaveable { mutableStateOf("") }

  val filteredCurrencies = if (searchQuery.isBlank()) {
    Currency.DEFAULT_CURRENCIES
  } else {
    Currency.DEFAULT_CURRENCIES.filter {
      it.code.contains(searchQuery, ignoreCase = true) ||
        it.name.contains(searchQuery, ignoreCase = true) ||
        it.symbol.contains(searchQuery, ignoreCase = true)
    }
  }

  Scaffold(
    modifier = modifier.fillMaxSize(),
    topBar = {
      TopAppBar(
        title = {
          Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
          )
        },
        navigationIcon = {
          IconButton(
            onClick = onBackClick,
            modifier = Modifier.testTag("currency_selection_back")
          ) {
            Icon(
              imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
              contentDescription = "Back"
            )
          }
        },
        colors = TopAppBarDefaults.topAppBarColors(
          containerColor = MaterialTheme.colorScheme.background
        )
      )
    }
  ) { innerPadding ->
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
        .padding(horizontal = 20.dp, vertical = 8.dp)
    ) {
      OutlinedTextField(
        value = searchQuery,
        onValueChange = { searchQuery = it },
        modifier = Modifier
          .fillMaxWidth()
          .testTag("currency_selection_search"),
        placeholder = { Text("Search by code, name, or symbol...") },
        leadingIcon = {
          Icon(
            imageVector = Icons.Rounded.Search,
            contentDescription = "Search"
          )
        },
        singleLine = true,
        shape = RoundedCornerShape(12.dp)
      )

      Spacer(modifier = Modifier.height(16.dp))

      LazyColumn(
        modifier = Modifier
          .fillMaxSize()
          .testTag("currency_selection_list"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(bottom = 16.dp)
      ) {
        items(filteredCurrencies, key = { it.code }) { currency ->
          CurrencyRow(
            currency = currency,
            isSelected = currency == selectedCurrency,
            onClick = { onCurrencySelected(currency) },
            testTag = "currency_select_${currency.code.lowercase()}"
          )
        }
      }
    }
  }
}
