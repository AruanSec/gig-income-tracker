# Financial calculation policy

## Money and existing records

Amounts are CAD. New entries and restores accept at most two decimal places,
up to CAD 9,999,999,999.99 per input amount. Decimal arithmetic avoids binary
floating-point sums. Ties round half up, away from zero; losses stay negative.

The versioned `exact-money-v1` startup migration converts PostgreSQL money
columns to `NUMERIC(15,2)` and SQLite money columns to decimal `TEXT`.
It rounds existing fare, tips, adjustments, expenses and GST/HST independently
to cents, then recomputes earnings as fare + tips − adjustments. IDs, owners,
notes and non-money fields are preserved. Both financial tables migrate in one
transaction. Invalid or out-of-range legacy values abort migration; investigate
them rather than switching databases. Back up before upgrading: rounding legacy
sub-cent values is irreversible without the original backup. Repeated startup
skips completed migrations. Older application versions are not supported against
this schema; rollback requires the matching pre-upgrade database backup.

## Rate years and reporting periods

Only a saved rate for the exact calendar year is used. New accounts have no
prepopulated rates; previously saved rates remain unchanged and require review.
The application does not certify saved rates as current CRA rates. Missing years
are excluded from mileage estimates, visibly flagged, and identified in exports.
Zero is not a substitute for a missing rate.

Annual mileage tiers reset on January 1. Trips are ordered by date, then ID for
same-day ties. Allocate tiers using all trips before filtering a month or quarter.
Each trip's estimate rounds once to cents; totals sum those rounded estimates.
Actual-cost business use rounds per receipt, then sums, so month and quarter
amounts reconcile with annual totals. Multi-day income belongs entirely to its
start date; it is not prorated. This reporting convention is not tax recognition
advice.

## Tax assumptions and limits

Kilometre estimates and operating receipts are alternative comparisons. The app
never adds them as a combined deductible total. CRA employee allowance rates do
not automatically establish a self-employed deduction. Actual vehicle expenses
need supporting receipts, a logbook and an appropriate business-use allocation;
category-specific limits and capital cost allowance are not calculated here.

Expense amounts are treated as recorded costs including any recorded GST/HST.
Tracked tax is informational: the app neither automatically claims an input tax
credit nor removes one from expenses. A filing calculation must avoid claiming
recoverable GST/HST again as an income-tax expense. Registration and credit rules
vary; commercial ridesharing and delivery need separate review. Recorded platform
adjustments are not assumed to be income-tax instalments.

Tax estimates apply one user-selected rate to positive planning profit. They
exclude CPP, progressive brackets, personal credits, instalments and GST/HST
returns. The business-use and tax-rate defaults are editable examples, not
verified facts about an account. A qualified Canadian tax review remains a
release requirement; this document specifies application behavior, not filing
eligibility.

## Reference guidance for review

- [CRA motor vehicle expenses](https://www.canada.ca/en/revenue-agency/services/tax/businesses/small-businesses-self-employed-income/business-income-tax-reporting/business-expenses/motor-vehicle-expenses.html)
- [CRA automobile allowance rates](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/benefits-allowances/automobile/automobile-motor-vehicle-allowances/automobile-allowance-rates.html)
- [CRA input tax credits](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/input-tax-credits.html)

Verify current guidance and the applicable year before entering rates or filing.
Live CRA pages were unavailable to the implementation environment; no current
rate certification or professional tax review is claimed.
