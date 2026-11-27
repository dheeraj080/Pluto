package com.pluto.app.domain.model

/**
 * Represents an expense category.
 *
 * Designed to be extensible for custom categories while offering standard defaults
 * for managing spending across currencies.
 */
data class Category(
  val id: String,
  val name: String,
  val iconName: String,
  val colorHex: String,
  val isCustom: Boolean = false
) {
  companion object {
    val TUITION = Category("tuition", "Tuition & University Fees", "School", "#8E44AD")
    val BOOKS_SUPPLIES = Category("books_supplies", "Books & Study Supplies", "MenuBook", "#3498DB")
    val DORM_RENT = Category("dorm_rent", "Dorm & Shared Housing", "Apartment", "#16A085")
    val CAMPUS_DINING = Category("campus_dining", "Campus Dining & Meal Plan", "Fastfood", "#E67E22")
    val VISA_IMMIGRATION = Category("visa_immigration", "Visa, Permits & Admin", "Badge", "#7F8C8D")

    val FOOD = Category("food", "Food & Dining", "Restaurant", "#FF6B6B")
    val GROCERIES = Category("groceries", "Groceries", "ShoppingCart", "#4ECDC4")
    val TRANSPORT = Category("transport", "Transport", "DirectionsSubway", "#45B7D1")
    val ACCOMMODATION = Category("accommodation", "Accommodation", "Home", "#96CEB4")
    val SHOPPING = Category("shopping", "Shopping", "ShoppingBag", "#FFEEAD")
    val ENTERTAINMENT = Category("entertainment", "Entertainment", "Movie", "#D4A5A5")
    val EDUCATION = Category("education", "Education & Courses", "School", "#9B59B6")
    val HEALTH = Category("health", "Health & Medical", "LocalHospital", "#E74C3C")
    val BILLS = Category("bills", "Bills & Utilities", "ReceiptLong", "#34495E")
    val TRAVEL = Category("travel", "Travel & Flights", "Flight", "#3498DB")
    val OTHER = Category("other", "Other", "Category", "#95A5A6")

    val DEFAULT_CATEGORIES: List<Category> = listOf(
      TUITION,
      BOOKS_SUPPLIES,
      DORM_RENT,
      CAMPUS_DINING,
      FOOD,
      GROCERIES,
      TRANSPORT,
      ACCOMMODATION,
      SHOPPING,
      ENTERTAINMENT,
      EDUCATION,
      HEALTH,
      BILLS,
      VISA_IMMIGRATION,
      TRAVEL,
      OTHER
    )

    fun getCategoriesForPersona(persona: UserPersona): List<Category> = when (persona) {
      UserPersona.INTERNATIONAL_STUDENT -> listOf(
        TUITION,
        BOOKS_SUPPLIES,
        CAMPUS_DINING,
        DORM_RENT,
        FOOD,
        GROCERIES,
        TRANSPORT,
        VISA_IMMIGRATION,
        ENTERTAINMENT,
        BILLS,
        TRAVEL,
        OTHER
      )
      UserPersona.EXPAT -> listOf(
        ACCOMMODATION,
        BILLS,
        GROCERIES,
        FOOD,
        TRANSPORT,
        HEALTH,
        SHOPPING,
        TRAVEL,
        VISA_IMMIGRATION,
        ENTERTAINMENT,
        OTHER
      )
      UserPersona.TOURIST -> listOf(
        TRAVEL,
        FOOD,
        ACCOMMODATION,
        ENTERTAINMENT,
        SHOPPING,
        TRANSPORT,
        OTHER
      )
    }

    fun findById(id: String): Category =
      DEFAULT_CATEGORIES.find { it.id == id } ?: OTHER
  }
}
