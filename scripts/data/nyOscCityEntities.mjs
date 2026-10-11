// NO SHEBANG — see scripts/lib/nyOsc.mjs.
/**
 * The 61 New York cities other than NYC, as OSC's FY2010 city file lists them.
 *
 * Generated once from docs/NY/city_all_years.zip and committed as data, so the
 * loader's entity set is reviewable in a diff rather than recomputed per run.
 *
 * ⚠ NYC is ABSENT and must stay absent — it is loaded from its own ACFRs
 * (PR #243) and OSC files it as a separate `cityny` dataset.
 *
 * ⚠ `municipalCode` is OSC's own stable id and is the source_entity_key.
 * Match on it, NEVER on the display name — a publisher rename would fork the
 * city otherwise.
 */
export const NY_CITY_ENTITIES = Object.freeze([
  { municipalCode: '010201000000', name: 'Albany', county: 'Albany' },
  { municipalCode: '270202000000', name: 'Amsterdam', county: 'Montgomery' },
  { municipalCode: '050203000000', name: 'Auburn', county: 'Cayuga' },
  { municipalCode: '180204000000', name: 'Batavia', county: 'Genesee' },
  { municipalCode: '130205000000', name: 'Beacon', county: 'Dutchess' },
  { municipalCode: '030206000000', name: 'Binghamton', county: 'Broome' },
  { municipalCode: '140207000000', name: 'Buffalo', county: 'Erie' },
  { municipalCode: '320208000000', name: 'Canandaigua', county: 'Ontario' },
  { municipalCode: '010209000000', name: 'Cohoes', county: 'Albany' },
  { municipalCode: '460210000000', name: 'Corning', county: 'Steuben' },
  { municipalCode: '110211000000', name: 'Cortland', county: 'Cortland' },
  { municipalCode: '060212000000', name: 'Dunkirk', county: 'Chautauqua' },
  { municipalCode: '070213000000', name: 'Elmira', county: 'Chemung' },
  { municipalCode: '350214000000', name: 'Fulton', county: 'Oswego' },
  { municipalCode: '320215000000', name: 'Geneva', county: 'Ontario' },
  { municipalCode: '280216000000', name: 'Glen Cove', county: 'Nassau' },
  { municipalCode: '520217000000', name: 'Glens Falls', county: 'Warren' },
  { municipalCode: '170218000000', name: 'Gloversville', county: 'Fulton' },
  { municipalCode: '460219000000', name: 'Hornell', county: 'Steuben' },
  { municipalCode: '100220000000', name: 'Hudson', county: 'Columbia' },
  { municipalCode: '500221000000', name: 'Ithaca', county: 'Tompkins' },
  { municipalCode: '060222000000', name: 'Jamestown', county: 'Chautauqua' },
  { municipalCode: '170223000000', name: 'Johnstown', county: 'Fulton' },
  { municipalCode: '510224000000', name: 'Kingston', county: 'Ulster' },
  { municipalCode: '140225000000', name: 'Lackawanna', county: 'Erie' },
  { municipalCode: '210226000000', name: 'Little Falls', county: 'Herkimer' },
  { municipalCode: '290227000000', name: 'Lockport', county: 'Niagara' },
  { municipalCode: '280228000000', name: 'Long Beach', county: 'Nassau' },
  { municipalCode: '410229000000', name: 'Mechanicville', county: 'Saratoga' },
  { municipalCode: '330230000000', name: 'Middletown', county: 'Orange' },
  { municipalCode: '550231000000', name: 'Mount Vernon', county: 'Westchester' },
  { municipalCode: '550233000000', name: 'New Rochelle', county: 'Westchester' },
  { municipalCode: '330232000000', name: 'Newburgh', county: 'Orange' },
  { municipalCode: '290235000000', name: 'Niagara Falls', county: 'Niagara' },
  { municipalCode: '290236000000', name: 'North Tonawanda', county: 'Niagara' },
  { municipalCode: '080237000000', name: 'Norwich', county: 'Chenango' },
  { municipalCode: '400238000000', name: 'Ogdensburg', county: 'St. Lawrence' },
  { municipalCode: '040239000000', name: 'Olean', county: 'Cattaraugus' },
  { municipalCode: '250240000000', name: 'Oneida', county: 'Madison' },
  { municipalCode: '360241000000', name: 'Oneonta', county: 'Otsego' },
  { municipalCode: '350242000000', name: 'Oswego', county: 'Oswego' },
  { municipalCode: '550243000000', name: 'Peekskill', county: 'Westchester' },
  { municipalCode: '090244000000', name: 'Plattsburgh', county: 'Clinton' },
  { municipalCode: '330245000000', name: 'Port Jervis', county: 'Orange' },
  { municipalCode: '130246000000', name: 'Poughkeepsie', county: 'Dutchess' },
  { municipalCode: '380247000000', name: 'Rensselaer', county: 'Rensselaer' },
  { municipalCode: '260248000000', name: 'Rochester', county: 'Monroe' },
  { municipalCode: '300249000000', name: 'Rome', county: 'Oneida' },
  { municipalCode: '550250000000', name: 'Rye', county: 'Westchester' },
  { municipalCode: '040251000000', name: 'Salamanca', county: 'Cattaraugus' },
  { municipalCode: '410252000000', name: 'Saratoga Springs', county: 'Saratoga' },
  { municipalCode: '420253000000', name: 'Schenectady', county: 'Schenectady' },
  { municipalCode: '300254000000', name: 'Sherrill', county: 'Oneida' },
  { municipalCode: '310255000000', name: 'Syracuse', county: 'Onondaga' },
  { municipalCode: '140256000000', name: 'Tonawanda', county: 'Erie' },
  { municipalCode: '380257000000', name: 'Troy', county: 'Rensselaer' },
  { municipalCode: '300258000000', name: 'Utica', county: 'Oneida' },
  { municipalCode: '220259000000', name: 'Watertown', county: 'Jefferson' },
  { municipalCode: '010260000000', name: 'Watervliet', county: 'Albany' },
  { municipalCode: '550261000000', name: 'White Plains', county: 'Westchester' },
  { municipalCode: '550262000000', name: 'Yonkers', county: 'Westchester' },
]);
