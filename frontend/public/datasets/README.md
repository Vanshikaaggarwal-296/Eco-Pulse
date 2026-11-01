# Public real-world campus electricity readings

`kitakyushu_2021_campus_electricity.csv` contains 8,760 hourly readings for 2021 from the Kitakyushu Science and Research Park campus energy-station dataset. These are real measured public data from Kitakyushu, Japan; they are **not** telemetry from the Eco-Pulse user's own campus. The building label intentionally says `Campus Aggregate` because the source is an aggregate campus energy-station series rather than building-by-building data.

Source load is reported in kW for hourly intervals. The CSV records interval energy in kWh (`average kW × 1 hour`), so the numeric load is unchanged. Timestamps use Japan Standard Time (`+09:00`). The matching source power workbook supplies measured solar generation and grid import; in all 8,760 source intervals those two sum to the reported electric load. The workbook does not provide row-level electricity cost or carbon values, so those fields are omitted rather than fabricated.

## Attribution

Liao, Wei; Jin, Xiaoyu; Ran, Yi; Xiao, Fu; Gao, Weijun; Li, Yanxue (2024). *A twenty-year dataset of hourly energy generation and consumption from district campus building energy systems*. Figshare dataset [DOI 10.6084/m9.figshare.24978645](https://doi.org/10.6084/m9.figshare.24978645). License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Source archive files: `Electricity load & Heating load & Cooling load & Hot water load.zip` and `Power.zip`; 2021 workbooks are used in this CSV.
