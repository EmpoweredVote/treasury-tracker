# Budget Data Directory

This directory contains the raw CSV budget data files that are processed by the budget processor script.

## Files

- `operating-budget.csv` - The main operating budget data file (required)
- `README.md` - This file

## CSV Format

Your operating budget CSV should have the following columns (at minimum):

- `fiscal_year` - The fiscal year (e.g., 2025)
- `primary_function` - Top-level category (e.g., "Public Safety", "Utilities")
- `priority` - Department or service area
- `service` - Specific service or program
- `approved_amount` - The approved budget amount
- `description` - Description of the line item
- `item_category` - Category of the expense

### Optional Columns

- `actual_amount` - Actual spending (if available)
- `recommended_amount` - Recommended budget
- `department`, `program`, `division` - Additional hierarchy levels
- `fund` - Fund name or type
- `sub_function` - Sub-category classification

## Getting Your Data

1. Place your `operating-budget.csv` file in this directory
2. Update `budgetConfig.json` in the root directory to match your CSV structure
3. Run `npm run process-budget` to generate the processed data

## Example Data

See the sample rows below for reference:

```csv
fiscal_year,priority,service,department,program,division,description,item_category,fund,approved_amount,actual_amount,recommended_amount,primary_function,sub_function
2025,Police,Main,,,,Salaries,Personnel Services,General,5000000.00,4980000.00,5100000.00,Public Safety,
2025,Fire,Main,,,,Equipment,Capital Outlay,General,250000.00,245000.00,260000.00,Public Safety,
```

## Need Help?

If your municipality's budget data is in a different format:

1. Try to export it to CSV with similar columns
2. Update the `hierarchy` field in `budgetConfig.json` to match your column names
3. Adjust the `amountColumn` to point to the correct amount field
4. Run the processor and check the output

The processor is flexible and can handle various CSV structures.
