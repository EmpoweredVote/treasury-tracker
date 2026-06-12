INSERT INTO treasury.source_registry (name, display_name, url)
SELECT 'omb-public-budget-database', 'OMB Public Budget Database', 'https://www.whitehouse.gov/omb/information-resources/budget/supplemental-materials/'
WHERE NOT EXISTS (SELECT 1 FROM treasury.source_registry WHERE name='omb-public-budget-database');
