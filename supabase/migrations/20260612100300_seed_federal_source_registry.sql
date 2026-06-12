INSERT INTO treasury.source_registry (name, display_name, url)
SELECT 'treasury-fiscal-data', 'Treasury Fiscal Data', 'https://fiscaldata.treasury.gov'
WHERE NOT EXISTS (SELECT 1 FROM treasury.source_registry WHERE name = 'treasury-fiscal-data');

INSERT INTO treasury.source_registry (name, display_name, url)
SELECT 'omb-historical-tables', 'OMB Historical Tables', 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/'
WHERE NOT EXISTS (SELECT 1 FROM treasury.source_registry WHERE name = 'omb-historical-tables');

INSERT INTO treasury.source_registry (name, display_name, url)
SELECT 'usaspending', 'USAspending.gov', 'https://www.usaspending.gov'
WHERE NOT EXISTS (SELECT 1 FROM treasury.source_registry WHERE name = 'usaspending');

INSERT INTO treasury.source_registry (name, display_name, url)
SELECT 'congress-gov', 'Congress.gov', 'https://www.congress.gov'
WHERE NOT EXISTS (SELECT 1 FROM treasury.source_registry WHERE name = 'congress-gov');

INSERT INTO treasury.source_registry (name, display_name, url)
SELECT 'govinfo', 'GovInfo', 'https://www.govinfo.gov'
WHERE NOT EXISTS (SELECT 1 FROM treasury.source_registry WHERE name = 'govinfo');
