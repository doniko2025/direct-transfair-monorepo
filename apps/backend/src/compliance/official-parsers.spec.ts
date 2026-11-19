import { diffOfficial, sanityError, type ExistingOfficial } from './official-diff';
import { isConfigured, OfficialListsService, providerSources } from './official-lists.service';
import { NameIndex } from './name-matching';
import { decodeEntities, ofacPersonName, parseCsv, parseEuXml, parseOfacCsv, parseUnXml, parseXml, xmlBlocks, type OfficialEntryInput } from './official-parsers';

// Fixtures construites d'après les formats publiés (ONU consolidated.xml, OFAC sdn.csv / alt.csv, UE « Financial Sanctions Files »).
const UN = `<?xml version="1.0"?>
<CONSOLIDATED_LIST dateGenerated="2026-11-19T00:00:00.000Z">
  <INDIVIDUALS>
    <INDIVIDUAL>
      <DATAID>6908555</DATAID><VERSIONNUM>1</VERSIONNUM>
      <FIRST_NAME>ABDUL</FIRST_NAME><SECOND_NAME>RAHMAN</SECOND_NAME><THIRD_NAME>al-Zahrani</THIRD_NAME><FOURTH_NAME/>
      <UN_LIST_TYPE>Al-Qaida</UN_LIST_TYPE><REFERENCE_NUMBER>QDi.001</REFERENCE_NUMBER>
      <NATIONALITY><VALUE>Afghanistan</VALUE></NATIONALITY>
      <INDIVIDUAL_ALIAS><QUALITY>Good</QUALITY><ALIAS_NAME>Abdul Rahman Aziz</ALIAS_NAME></INDIVIDUAL_ALIAS>
      <INDIVIDUAL_ALIAS><QUALITY>Low</QUALITY><ALIAS_NAME/></INDIVIDUAL_ALIAS>
      <INDIVIDUAL_DATE_OF_BIRTH><TYPE_OF_DATE>EXACT</TYPE_OF_DATE><DATE>1968-03-04</DATE></INDIVIDUAL_DATE_OF_BIRTH>
    </INDIVIDUAL>
    <INDIVIDUAL>
      <DATAID>111</DATAID><FIRST_NAME>MAMADOU</FIRST_NAME><SECOND_NAME>na</SECOND_NAME><UN_LIST_TYPE>DRC</UN_LIST_TYPE><REFERENCE_NUMBER>CDi.002</REFERENCE_NUMBER>
      <INDIVIDUAL_DATE_OF_BIRTH><YEAR>1975</YEAR></INDIVIDUAL_DATE_OF_BIRTH>
    </INDIVIDUAL>
    <INDIVIDUAL><DATAID>222</DATAID><FIRST_NAME>X</FIRST_NAME></INDIVIDUAL>
  </INDIVIDUALS>
  <ENTITIES>
    <ENTITY>
      <DATAID>333</DATAID><FIRST_NAME>Banque &amp; Cie “Nord”</FIRST_NAME><UN_LIST_TYPE>Taliban</UN_LIST_TYPE><REFERENCE_NUMBER>TAe.009</REFERENCE_NUMBER>
      <ENTITY_ALIAS><QUALITY>Good</QUALITY><ALIAS_NAME>Nord Bank</ALIAS_NAME></ENTITY_ALIAS>
      <ENTITY_ADDRESS><COUNTRY>Pakistan</COUNTRY></ENTITY_ADDRESS>
    </ENTITY>
  </ENTITIES>
</CONSOLIDATED_LIST>`;

const SDN = [
  '1234,"DUPONT, Jean Paul","individual","SDGT] [IRGC",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"DOB 12 Jan 1970; POB Havana, Cuba; nationality Cuba; Gender Male"',
  '2345,"ACME TRADING, INC.",-0- ,"SYRIA",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ',
  '3456,"MV SEA WOLF","vessel","IRAN",-0- ,-0- ,"Tanker",-0- ,-0- ,"Panama",-0- ,-0- ',
  '4567,"BAH, Mamadou","individual","SDGT",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"nationality Guinea"',
  '\u001a',
].join('\r\n').replace(/ ,/g, ',');
const ALT = ['1234,"5678","aka","DUPONT, J. Paul",-0- ', '2345,"1","aka","ACME TRADING CO",-0- '].join('\n').replace(/ $/gm, '');

const EU = `<?xml version="1.0" encoding="UTF-8"?>
<export generationDate="2026-11-19T01:00:00">
 <sanctionEntity designationDetails="" unitedNationId="" euReferenceNumber="EU.1.23" logicalId="13">
  <regulation regulationType="regulation" programme="SYR" numberTitle="36/2012"/>
  <regulation regulationType="regulation" programme="SYR" numberTitle="1/2013"/>
  <subjectType code="person" classificationCode="P"/>
  <nameAlias firstName="Ahmed" middleName="" lastName="Khalil" wholeName="Ahmed Khalil" strong="true" logicalId="14"/>
  <nameAlias firstName="" middleName="" lastName="" wholeName="Ahmad Khalil" strong="false" logicalId="15"/>
  <citizenship region="" countryIso2Code="SY" countryDescription="SYRIA" logicalId="16"/>
  <birthdate circa="false" birthdate="1960-02-03" year="1960" logicalId="17"/>
 </sanctionEntity>
 <sanctionEntity euReferenceNumber="EU.2.4" logicalId="20"><subjectType code="enterprise"/><nameAlias firstName="" lastName="" wholeName="Société Générale d'Export" logicalId="21"/></sanctionEntity>
 <sanctionEntity logicalId="30"/>
</export>`;

describe('XML minimal', () => {
  it('décode les entités et lit attributs/enfants', () => {
    expect(decodeEntities('A &amp; B &lt;C&gt; &#233; &#x41;')).toBe('A & B <C> é A');
    const n = parseXml('<a x="1" Y=\'2\'><b>t &amp; u</b><c/><!-- c --><![CDATA[<z>]]></a>');
    expect(n.attrs).toEqual({ x: '1', y: '2' });
    expect(n.children.map((c) => c.name)).toEqual(['b', 'c']);
    expect(n.children[0]?.text).toBe('t & u');
    expect(n.text).toBe('<z>');
  });
  it('xmlBlocks ne confond pas INDIVIDUAL, INDIVIDUALS et INDIVIDUAL_ALIAS', () => {
    expect([...xmlBlocks(UN, 'INDIVIDUAL')]).toHaveLength(3);
    expect([...xmlBlocks('<a/><a x="1"/><a>t</a>', 'a')]).toHaveLength(3);
  });
});

describe('ONU', () => {
  const list = parseUnXml(UN);
  it('lit personnes et entités, saute les fiches trop courtes', () => {
    expect(list.map((e) => e.externalId)).toEqual(['6908555', '111', '333']);
  });
  it('assemble le nom, les alias, l’année et la nationalité', () => {
    const e = list[0] as OfficialEntryInput;
    expect(e.provider).toBe('UN');
    expect(e.fullName).toBe('ABDUL RAHMAN al-Zahrani');
    expect(e.aliases).toEqual(['Abdul Rahman Aziz']);
    expect(e.birthYear).toBe(1968);
    expect(e.country).toBe('Afghanistan');
    expect(e.reference).toBe('QDi.001');
    expect(e.programs).toEqual(['Al-Qaida']);
  });
  it('ignore « na », lit l’année seule, décode les entités d’une entité', () => {
    expect(list[1]?.fullName).toBe('MAMADOU');
    expect(list[1]?.birthYear).toBe(1975);
    expect(list[2]?.fullName).toBe('Banque & Cie “Nord”');
    expect(list[2]?.aliases).toEqual(['Nord Bank']);
    expect(list[2]?.country).toBe('Pakistan');
  });
});

describe('OFAC', () => {
  it('CSV : guillemets, virgules internes, CRLF, caractère de fin', () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\nx,y\n\u001a')).toEqual([['a', 'b,c', 'd "e"'], ['x', 'y']]);
  });
  it('« NOM, Prénom » devient « Prénom NOM »', () => {
    expect(ofacPersonName('DUPONT, Jean Paul')).toBe('Jean Paul DUPONT');
    expect(ofacPersonName('ACME')).toBe('ACME');
  });
  const list = parseOfacCsv(SDN, ALT);
  it('ignore navires et aéronefs, garde personnes et entités', () => {
    expect(list.map((e) => e.externalId)).toEqual(['1234', '2345', '4567']);
  });
  it('personne : nom remis dans l’ordre, alias, année, nationalité, programmes', () => {
    const e = list[0] as OfficialEntryInput;
    expect(e.fullName).toBe('Jean Paul DUPONT');
    expect(e.aliases).toEqual(['J. Paul DUPONT']);
    expect(e.birthYear).toBe(1970);
    expect(e.country).toBe('Cuba');
    expect(e.programs).toEqual(['SDGT', 'IRGC']);
  });
  it('entité : nom conservé tel quel, alias ajouté', () => {
    expect(list[1]?.fullName).toBe('ACME TRADING, INC.');
    expect(list[1]?.aliases).toEqual(['ACME TRADING CO']);
  });
  it('fonctionne sans alt.csv', () => {
    expect(parseOfacCsv(SDN)).toHaveLength(3);
  });
});

describe('Union européenne', () => {
  const list = parseEuXml(EU);
  it('lit les fiches et saute celles sans nom', () => {
    expect(list.map((e) => e.externalId)).toEqual(['13', '20']);
  });
  it('nom principal, alias, pays, année, programmes sans doublon', () => {
    const e = list[0] as OfficialEntryInput;
    expect(e.fullName).toBe('Ahmed Khalil');
    expect(e.aliases).toEqual(['Ahmad Khalil']);
    expect(e.country).toBe('SY');
    expect(e.birthYear).toBe(1960);
    expect(e.programs).toEqual(['SYR']);
    expect(e.reference).toBe('EU.1.23');
  });
  it('apostrophe et accents conservés', () => {
    expect(list[1]?.fullName).toBe("Société Générale d'Export");
  });
});

describe('Rapprochement avec les listes officielles', () => {
  it('retrouve une fiche ONU par son alias, une translittération et l’ordre des mots', () => {
    const idx = new NameIndex(parseUnXml(UN).map((e) => ({ id: e.externalId, kind: 'SANCTION', fullName: e.fullName, aliases: e.aliases, source: 'UN' })));
    const hit = idx.query([{ role: 'SENDER', name: 'Aziz Abdul Rahman' }], 88);
    expect(hit[0]?.entryId).toBe('6908555');
    expect(hit[0]?.source).toBe('UN');
    expect(idx.query([{ role: 'SENDER', name: 'Mamadou Diallo' }], 88)).toHaveLength(0);
  });
});

const ex = (id: string, over: Partial<ExistingOfficial> = {}): ExistingOfficial => ({
  id: `row-${id}`, externalId: id, fullName: `Nom ${id}`, aliases: [], country: null, birthYear: null, reference: null, programs: [], isActive: true, ...over,
});
const inc = (id: string, over: Partial<OfficialEntryInput> = {}): OfficialEntryInput => ({
  provider: 'UN', externalId: id, fullName: `Nom ${id}`, aliases: [], country: null, birthYear: null, reference: null, programs: [], ...over,
});

describe('diffOfficial', () => {
  it('crée, modifie, désactive, et laisse le reste intact', () => {
    const d = diffOfficial([ex('1'), ex('2'), ex('3')], [inc('1'), inc('2', { fullName: 'Autre nom' }), inc('4')]);
    expect(d.unchanged).toBe(1);
    expect(d.toCreate.map((e) => e.externalId)).toEqual(['4']);
    expect(d.toUpdate.map((u) => u.id)).toEqual(['row-2']);
    expect(d.toDeactivate).toEqual(['row-3']);
  });
  it('l’ordre des alias ne compte pas ; une fiche désactivée qui revient est réactivée', () => {
    const d = diffOfficial([ex('1', { aliases: ['b', 'a'] }), ex('2', { isActive: false })], [inc('1', { aliases: ['a', 'b'] }), inc('2')]);
    expect(d.unchanged).toBe(1);
    expect(d.toUpdate.map((u) => u.id)).toEqual(['row-2']);
    expect(d.toDeactivate).toEqual([]);
  });
  it('ignore les doublons du fichier et ne redésactive pas une fiche déjà inactive', () => {
    const d = diffOfficial([ex('9', { isActive: false })], [inc('5'), inc('5', { fullName: 'Autre' })]);
    expect(d.toCreate).toHaveLength(1);
    expect(d.toDeactivate).toEqual([]);
  });
});

describe('sanityError', () => {
  it('refuse un fichier vide ou amputé, accepte une variation normale', () => {
    expect(sanityError(0, 0)).toMatch(/Aucune fiche/);
    expect(sanityError(1000, 400)).toMatch(/refusée/);
    expect(sanityError(1000, 980)).toBeNull();
    expect(sanityError(10, 4)).toBeNull(); // petite liste : pas de seuil relatif
    expect(sanityError(0, 5)).toBeNull();
  });
});

describe('adresses et lecture par fournisseur', () => {
  it('adresses par défaut, surcharges par variables, UE sans adresse par défaut', () => {
    const d = providerSources({} as NodeJS.ProcessEnv);
    expect(d.UN[0]).toMatch(/^https:\/\/scsanctions\.un\.org/);
    expect(d.OFAC).toHaveLength(2);
    expect(d.EU).toEqual([]);
    expect(isConfigured('EU', {} as NodeJS.ProcessEnv)).toBe(false);
    expect(providerSources({ OFFICIAL_LIST_EU_URL: ' https://x/y?token=1 ' } as unknown as NodeJS.ProcessEnv).EU).toEqual(['https://x/y?token=1']);
  });
  it('parse() route chaque fournisseur vers son lecteur', () => {
    const svc = new OfficialListsService({} as never);
    expect(svc.parse('UN', [UN])).toHaveLength(3);
    expect(svc.parse('OFAC', [SDN, ALT])).toHaveLength(3);
    expect(svc.parse('EU', [EU])).toHaveLength(2);
  });
});
