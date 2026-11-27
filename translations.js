"use strict";
const PAINI_TRANSLATIONS = [
  ["Tallennetut tulokset eivät välttämättä kata kaikkia kilpailuja tai painijoiden koko historiaa.","The saved results may not cover every competition or a wrestler’s full history.","De sparade resultaten omfattar inte nödvändigtvis alla tävlingar eller brottarnas hela historik."],
  ["Kuulas · vaalea","Clarity · light","Klar · ljus"],
  ["Kupari · tumma","Copper · dark","Koppar · mörk"],
  ["Kuulas on vaalea ulkoasu.","Clarity is a light design.","Klar är ett ljust utseende."],
  ["Kupari on tumma ulkoasu.","Copper is a dark design.","Koppar är ett mörkt utseende."],
  ["Ulkoasuversio","Visual design","Utseendeversion"],
  ["Nykyinen · punainen","Current · red","Nuvarande · röd"],
  ["Vertailu · sinikulta","Alternative · blue and gold","Alternativ · blå och guld"],
  ["Sinikulta on tumma ulkoasu.","Blue and gold is a dark design.","Blått och guld är ett mörkt utseende."],
  ["Mittauspäivä","Measurement date","Mätdatum"],
  ["Aiempien mittausten ajankohta perustuu tallennettuun julkaisuversioon.","Historical measurement times are based on saved publication versions.","Tidpunkterna för tidigare mätningar baseras på sparade publiceringsversioner."],
  ["Ei tallennettuja mittauspisteitä.", "No recorded measurements.", "Inga sparade mätpunkter."],
  ["Yksi mittauspäivä. Viiva muodostuu seuraavan mittauspäivän jälkeen.", "One measurement day. A line will appear after the next measurement day.", "En mätdag. En linje visas efter nästa mätdag."],
  ["Mittauspisteet taulukkona", "Measurements as a table", "Mätpunkter som tabell"],
  ["Kattavuuden mittaushistoria", "Coverage measurement history", "Täckningens mäthistorik"],
  ["Mittausaika (Suomen aika)", "Measurement time (Finnish time)", "Mättid (finsk tid)"],
  ["Punaiset viivat näyttävät tallennettujen mittausten kehityksen. Kuvaajassa näkyy kunkin päivän viimeisin mittaus. Kuvaajien pystyakselit on sovitettu mittauksiin. Aineiston laajentuminen voi myös laskea prosenttia.", "Red lines show the recorded measurements over time. The chart uses the last measurement of each day. Each chart has a vertical scale fitted to its measurements. Expanding the collection can also lower the percentage.", "Röda linjer visar de sparade mätningarnas utveckling. Diagrammet visar varje dags sista mätning. Diagrammens vertikala axlar är anpassade till mätningarna. Ett utökat material kan också sänka procentandelen."],
  ["Kilpailusijoitukset, ottelut ja seurat. Löydä painijasi ja seuraa suosikkejasi.","Competition placements, bouts and clubs. Find your wrestler and follow your favorites.","Tävlingsplaceringar, matcher och föreningar. Hitta din brottare och följ dina favoriter."],
  ["Painija – tulokset ja tilastot", "Painija – results and statistics", "Painija – resultat och statistik"],
  ["Painija – etusivu", "Painija – home", "Painija – startsida"],
  ["Suomalaisten painijoiden tulokset ja tilastot", "Results and statistics of Finnish wrestlers", "Finländska brottares resultat och statistik"],
  ["TULOKSET & TILASTOT", "RESULTS & STATISTICS", "RESULTAT & STATISTIK"],
  ["Kuvan tiedot", "Photo credits", "Bildinformation"],
  ["Kuva: © Marie-Lan Nguyen / Wikimedia Commons.", "Photo: © Marie-Lan Nguyen / Wikimedia Commons.", "Foto: © Marie-Lan Nguyen / Wikimedia Commons."],
  ["Alkuperäinen kuva", "Original photo", "Originalbild"],
  ["Kuvaa on pienennetty ja sen päällä on tumma sävytys. Kuvituskuva kansainvälisestä painista.", "The photo has been resized and has a dark overlay. Illustrative photo of international wrestling.", "Bilden har förminskats och har ett mörkt överlägg. Illustrationsbild av internationell brottning."],
  ["Ilmoitukset toimivat tällä sivulla, mutta selain ei salli niiden tallentamista.", "Notifications work on this page, but the browser does not allow saving them.", "Aviseringarna fungerar på denna sida, men webbläsaren tillåter inte att de sparas."],
  ["Painijan kilpailutulokset", "Wrestler competition results", "Brottarens tävlingsresultat"],
  ["Kuvaajat ja vuosittaiset tilastot", "Charts and yearly statistics", "Diagram och årlig statistik"],
  ["Nimet, seurat ja lähdetiedot", "Names, clubs and source details", "Namn, klubbar och källuppgifter"],
  ["Uusi tulos", "New result", "Nytt resultat"],
  ["Ei uusia suosikkituloksia. Nykyiset tulokset muodostavat seurannan lähtötason.", "No new favorite results. Current results form the starting point for tracking.", "Inga nya favoritresultat. Nuvarande resultat utgör utgångspunkten för bevakningen."],
  ["Tyhjennä ilmoituslista", "Clear notifications", "Töm aviseringarna"],
  ["Merkitse kaikki luetuiksi", "Mark all as read", "Markera alla som lästa"],
  ["Seuraa suosikkipainijoiden uusia tuloksia", "Follow new results of favorite wrestlers", "Följ favoritbrottarnas nya resultat"],
  ["Näet täällä suosikkipainijoiden uudet julkaistut sijoitukset. Ilmoitukset näkyvät tässä selaimessa sivuston ollessa käytössä.", "New published placements of your favorite wrestlers appear here while you use the site in this browser.", "Här visas nya publicerade placeringar för dina favoritbrottare när du använder webbplatsen i denna webbläsare."],
  ["Uudet suosikkitulokset", "New favorite results", "Nya favoritresultat"],
  ["Rajaa suosikkihakua", "Filter favorite search", "Filtrera favoritsökning"],
  ["Rajaa hakua", "Filter search", "Filtrera sökning"],
  ["Lähdemerkinnän tyyppi", "Source entry type", "Typ av källpost"],
  ["Kaikki merkinnät", "All entries", "Alla poster"],
  ["Seuramerkinnät", "Club entries", "Klubbposter"],
  ["Vain KLL-merkinnät", "KLL entries only", "Endast KLL-poster"],
  ["Hakuehdotukset", "Search suggestions", "Sökförslag"],
  ["Painija valittu suosikiksi.", "Wrestler added to favorites.", "Brottaren har lagts till i favoriter."],
  ["Painija poistettu suosikeista.", "Wrestler removed from favorites.", "Brottaren har tagits bort från favoriter."],
  ["Tietosuoja ja selaimen tallennukset", "Privacy and browser storage", "Integritet och webbläsarlagring"],

  ["Sijoituksia", "Placements", "Placeringar"],
  ["Jaa painijan profiili", "Share wrestler profile", "Dela brottarprofil"],
  ["Ohjeet tuloshakuun", "Result search help", "Hjälp för resultatsökning"],
  ["Valittuja hakuehtoja", "Selected search options", "Valda sökvillkor"],
  ["Rajaa ja järjestä tuloksia", "Filter and sort results", "Filtrera och sortera resultat"],
  ["Tulokset", "Results", "Resultat"],
  ["Asetukset", "Settings", "Inställningar"],
  ["Ei hakutuloksia.", "No search results.", "Inga sökresultat."],
  ["Suosikkilista on täynnä. Poista ensin jokin suosikki.", "Your favorites list is full. Remove a favorite first.", "Favoritlistan är full. Ta först bort en favorit."],
  ["Oletusnäkymä palautettu.", "Default home restored.", "Standardvyn har återställts."],
  ["Valinnat toimivat tällä sivulla, mutta selain ei salli niiden tallentamista.", "Your choices work on this page, but the browser does not allow saving them.", "Dina val fungerar på den här sidan, men webbläsaren tillåter inte att de sparas."],
  ["Etusivun valinnat tallennettu.", "Home choices saved.", "Startsidesvalen har sparats."],
  ["Poista seura suosikeista", "Remove club from favorites", "Ta bort föreningen från favoriter"],
  ["Lisää seura suosikiksi", "Add club to favorites", "Lägg till föreningen som favorit"],
  ["Poista painija suosikeista", "Remove wrestler from favorites", "Ta bort brottaren från favoriter"],
  ["Lisää painija suosikiksi", "Add wrestler to favorites", "Lägg till brottaren som favorit"],
  ["Valitse suosikkipainijat ja -seurat Muokkaa etusivua -kohdasta.", "Select favorite wrestlers and clubs under Customize home.", "Välj favoritbrottare och föreningar under Anpassa startsidan."],
  ["Suosikkia tai sen tuloksia ei löydy nykyisestä aineistosta.", "This favorite or its results are unavailable in the current collection.", "Favoriten eller dess resultat finns inte i det aktuella materialet."],
  ["Et ole vielä valinnut suosikkeja.", "You have not selected any favorites yet.", "Du har inte valt några favoriter ännu."],
  ["Lisää suosikiksi", "Add to favorites", "Lägg till som favorit"],
  ["Poista suosikeista", "Remove from favorites", "Ta bort från favoriter"],
  ["Siirrä alaspäin", "Move down", "Flytta ned"],
  ["Siirrä ylöspäin", "Move up", "Flytta upp"],
  ["Palauta oletusnäkymä", "Restore default home", "Återställ standardvyn"],
  ["Valitut suosikit", "Selected favorites", "Valda favoriter"],
  ["Kirjoita vähintään kaksi merkkiä…", "Enter at least two characters…", "Skriv minst två tecken…"],
  ["Etsi suosikkiseuraa", "Find a favorite club", "Sök en favoritförening"],
  ["Etsi suosikkipainijaa", "Find a favorite wrestler", "Sök en favoritbrottare"],
  ["Suosikkien uusimmat tulokset", "Latest results from favorites", "Favoriternas senaste resultat"],
  ["Aineiston määrät", "Collection totals", "Materialets omfattning"],
  ["Etusivun osiot ja järjestys", "Home sections and order", "Startsidesavsnitt och ordning"],
  ["Valinnat tallentuvat vain tähän selaimeen. Kirjautumista ei tarvita.", "Your choices are saved only in this browser. No sign-in is needed.", "Dina val sparas endast i den här webbläsaren. Ingen inloggning behövs."],
  ["Muokkaa etusivua", "Customize home", "Anpassa startsidan"],
  ["Tiedot päivittyvät automaattisesti.", "Data updates automatically.", "Uppgifterna uppdateras automatiskt."],
  ["Uusia tietoja ei voitu ladata. Aiemmat tiedot ovat käytössä.", "New data could not be loaded. Previous data remains available.", "Nya uppgifter kunde inte laddas. Tidigare uppgifter är tillgängliga."],
  ["Tietoja ei voitu ladata. Tarkista verkkoyhteys. Latausta yritetään uudelleen yhteyden palattua.", "Data could not be loaded. Check your connection. Loading will resume when the connection returns.", "Uppgifterna kunde inte laddas. Kontrollera anslutningen. Laddningen återupptas när anslutningen återställs."],
  ["Aiemmin ladatut tiedot ovat käytössä.", "Previously loaded data is available.", "Tidigare laddade uppgifter är tillgängliga."],

  ["Yleishaku", "General search", "Allmän sökning"],
  ["Nimi, seura, kilpailu tai paikkakunta…", "Name, club, competition or location…", "Namn, förening, tävling eller ort…"],
  ["Hae tuloksia nimellä, seuralla, kilpailulla tai paikkakunnalla ja tarkenna hakua suodattimilla.", "Search results by name, club, competition or location and refine your search using the filters.", "Sök resultat med namn, förening, tävling eller ort och avgränsa sökningen med filtren."],
  ["Kattavuus kuvaa valittuja kilpailuja kokonaisuudessaan. Nimi-, seura-, ikäluokka- ja painimuotorajaus eivät muuta kattavuuslukuja.", "Coverage describes the selected competitions as a whole. Name, club, age and style filters do not change these figures.", "Täckningen beskriver de valda tävlingarna som helhet. Filter för namn, förening, ålder och stil ändrar inte dessa tal."],
  ["Painijan kattavuus koskee kaikkia aineiston vuosia.", "Wrestler coverage includes every year in the collection.", "Brottarens täckning gäller alla år i materialet."],

  ["Takaisin seuran profiiliin", "Back to club profile", "Tillbaka till föreningsprofilen"],
  ["Takaisin etusivulle", "Back to home", "Tillbaka till startsidan"],
  ["Takaisin kilpailuihin", "Back to competitions", "Tillbaka till tävlingar"],
  ["Takaisin otteluihin", "Back to bouts", "Tillbaka till matcher"],

  ["Ulkoasu", "Appearance", "Utseende"],
  ["Järjestelmän mukaan", "Use system setting", "Enligt systemet"],
  ["Vaalea", "Light", "Ljust"],
  ["Tumma", "Dark", "Mörkt"],
  ["Etusivu", "Home", "Startsida"],
  ["Seurat", "Clubs", "Föreningar"],
  ["Vertailu", "Compare", "Jämför"],
  ["SUOMALAINEN PAINI · 2020–2026", "FINNISH WRESTLING · 2020–2026", "FINLÄNDSK BROTTNING · 2020–2026"],
  ["Painin tulokset yhdessä paikassa", "Wrestling results in one place", "Brottningsresultat på ett ställe"],
  ["Kilpailusijoitukset, ottelut ja seurojen saavutukset. Tutustu tallennettuun aineistoon tai etsi oma painijasi.", "Placements, bouts and club achievements. Explore the collection or find a wrestler.", "Placeringar, matcher och föreningarnas framgångar. Utforska materialet eller hitta en brottare."],
  ["Etsi painijan tuloksia", "Find a wrestler's results", "Hitta en brottares resultat"],
  ["Kirjoita painijan nimi…", "Enter the wrestler's name…", "Skriv brottarens namn…"],
  ["Hae tuloksia", "Search results", "Sök resultat"],
  ["Avaa otteluhaku", "Open bout search", "Öppna matchsökning"],
  ["Tutustu seuroihin", "Explore clubs", "Utforska föreningar"],
  ["Vertaile kilpailuja", "Compare competitions", "Jämför tävlingar"],
  ["Tallennetun aineiston määrät", "Collection totals", "Materialets omfattning"],
  ["Tallennetun aineiston kattavuus", "Coverage of stored data", "Täckning av sparade uppgifter"],
  ["Uusimmat tallennetut kilpailut", "Latest stored competitions", "Senast sparade tävlingar"],
  ["Seurat perustuvat tulosten lähdemerkintöihin. KLL-paikkakuntia ei yhdistetä seuroihin eikä kirjoitusasuja arvata samoiksi.", "Clubs use the original result labels. KLL locations are not merged into clubs, and different spellings are not assumed to be the same club.", "Föreningarna bygger på källornas uppgifter. KLL-orter slås inte ihop med föreningar och olika stavningar antas inte avse samma förening."],
  ["Etsi seuraa tai lähdemerkintää", "Find a club or source label", "Sök förening eller källbeteckning"],
  ["Kirjoita seuran nimi…", "Enter a club name…", "Skriv föreningens namn…"],
  ["Takaisin seuroihin", "Back to clubs", "Tillbaka till föreningar"],
  ["Rajaa seuran tuloksia vuodella", "Filter club results by year", "Filtrera föreningens resultat efter år"],
  ["Vuosittaiset sijoitukset", "Yearly placements", "Årliga placeringar"],
  ["Seuran sijoitukset koko aineistossa", "Club placements in the full collection", "Föreningens placeringar i hela materialet"],
  ["Painijat valitussa aineistossa", "Wrestlers in the selected data", "Brottare i valt material"],
  ["Kilpailut valitussa aineistossa", "Competitions in the selected data", "Tävlingar i valt material"],
  ["Kilpailujen vertailu", "Competition comparison", "Tävlingsjämförelse"],
  ["Vertaile kahta tallennettua kilpailua. Painijatunnusten määrä voi poiketa tulosrivien määrästä, jos painija esiintyy useassa sarjassa.", "Compare two stored competitions. Wrestler identifiers and result rows may differ when a wrestler enters multiple categories.", "Jämför två sparade tävlingar. Antalet brottar-ID:n kan skilja sig från antalet resultatrader när en brottare deltar i flera klasser."],
  ["Etsi ensimmäistä kilpailua", "Find the first competition", "Sök den första tävlingen"],
  ["Ensimmäinen kilpailu", "First competition", "Första tävlingen"],
  ["Etsi toista kilpailua", "Find the second competition", "Sök den andra tävlingen"],
  ["Toinen kilpailu", "Second competition", "Andra tävlingen"],
  ["Valittujen kilpailujen vertailu", "Comparison of selected competitions", "Jämförelse av valda tävlingar"],
  ["Vertailtava tieto", "Metric", "Uppgift"],
  ["Kattavuusluvut koskevat tallennettuja tietoja. Kilpailujen puuttuvia osallistujia tai otteluita ei arvioida.", "Coverage figures describe stored data. Missing participants or bouts are not estimated.", "Täckningen gäller sparade uppgifter. Saknade deltagare eller matcher uppskattas inte."],
  ["Valitun kilpailuaineiston kattavuus", "Coverage of selected competitions", "Täckning för valda tävlingar"],
  ["Painijan ottelutietojen kattavuus", "Coverage of the wrestler's bout data", "Täckning av brottarens matchuppgifter"],
  ["Kilpailusijoituksia", "Competition placements", "Tävlingsplaceringar"],
  ["Vahvistettuja otteluita", "Confirmed bouts", "Bekräftade matcher"],
  ["Pisteet ilmoitettu", "Points reported", "Poäng angivna"],
  ["Voittotapa vahvistettu", "Victory method confirmed", "Segersätt bekräftat"],
  ["Hyväksytyt käsitellyistä otteluista", "Accepted out of processed bouts", "Godkända av behandlade matcher"],
  ["Ei laskettavissa", "Cannot be calculated", "Kan inte beräknas"],
  ["Kattavuustietoja ladataan…", "Loading coverage information…", "Laddar täckningsinformation…"],
  ["Ei tallennettuja ottelutietoja.", "No stored bout information.", "Inga sparade matchuppgifter."],
  ["Prosentit koskevat tallennettuja ja käsiteltyjä tietoja. Ne eivät osoita, että kaikki kilpailut tai niiden kaikki ottelut olisivat löytyneet.", "Percentages apply to stored and processed data. They do not establish that every competition or every bout has been found.", "Procenttalen gäller sparade och behandlade uppgifter. De visar inte att alla tävlingar eller alla matcher har hittats."],
  ["Vain KLL-lähteissä esiintyvä merkintä.", "A label appearing only in KLL sources.", "En beteckning som endast förekommer i KLL-källor."],
  ["Avaa seuran profiili", "Open club profile", "Öppna föreningsprofil"],
  ["Seuran tilastot lasketaan vain tämän seuramerkinnän tulosriveistä. Painijan muiden seurojen tuloksia ei lasketa seuran saavutuksiksi.", "Club statistics use only results under this club label. Results for other clubs are not counted as this club's achievements.", "Föreningens statistik omfattar endast resultat under denna föreningsbeteckning. Brottarens resultat för andra föreningar räknas inte som denna förenings framgångar."],
  ["Painijatunnuksia", "Wrestler identifiers", "Brottar-ID:n"],
  ["Mitalisijoituksia", "Podium placements", "Medaljplaceringar"],
  ["Valitse kilpailu", "Select a competition", "Välj en tävling"],
  ["Valitse kaksi eri kilpailua.", "Select two different competitions.", "Välj två olika tävlingar."],
  ["Valitse kaksi kilpailua vertailuun.", "Select two competitions to compare.", "Välj två tävlingar att jämföra."],
  ["Seura- ja paikkakuntamerkintöjä", "Club and location labels", "Förenings- och ortsbeteckningar"],
  ["Ikäluokkia", "Age groups", "Åldersklasser"],
  ["Tuonnin kattavuusvaroituksia", "Import coverage warnings", "Varningar om importens täckning"],
  ["Uran kohokohdat tässä aineistossa", "Career highlights in this collection", "Karriärhöjdpunkter i materialet"],
  ["Kilpailuvoittoja", "Competition wins", "Tävlingsvinster"],
  ["Paras SM-sijoitus", "Best Finnish championship placement", "Bästa FM-placering"],
  ["Viimeisimmät tulokset", "Latest results", "Senaste resultat"],
  ["Kohokohdat koskevat koko tallennettua aineistoa. Vuosirajaus ei muuta tätä yhteenvetoa.", "Highlights cover the full stored collection. The year filter does not change this summary.", "Höjdpunkterna gäller hela det sparade materialet. Årsfiltret ändrar inte denna sammanfattning."],
  ["Kattavuustiedot eivät ole saatavilla tälle aineistoversiolle. Yritä Päivitä tiedot -painiketta.", "Coverage information is unavailable for this data version. Try Refresh data.", "Täckningsinformation saknas för denna dataversion. Prova Uppdatera data."],
  ["Tuonnin kattavuusvaroituksia sisältäviä kilpailuja:", "Competitions with import coverage warnings:", "Tävlingar med varningar om importens täckning:"],
  ["Henkilöviittauksen tarkistusta odottavia otteluita:", "Bouts awaiting identity verification:", "Matcher som väntar på kontroll av personkopplingen:"],
  ["Lähdemerkintöjä:", "Source labels:", "Källbeteckningar:"],

  ["Otteluvoitot ja tappiot vuosittain", "Bout wins and losses by year", "Matchvinster och förluster per år"],
  ["Vihreä = voitot, vaaleanpunainen = tappiot, harmaa = epäselvät. Kuvaaja ja taulukko sisältävät kaikki hakuehtoihin sopivat ottelut. Pois jätettyjä otteluita ei lasketa mukaan.", "Green = wins, pink = losses, grey = unresolved. The chart and table include all bouts matching the filters. Omitted bouts are not counted.", "Grönt = vinster, rosa = förluster, grått = oklara. Diagrammet och tabellen omfattar alla matcher som matchar filtren. Utelämnade matcher räknas inte med."],
  ["Epäselvät", "Unresolved", "Oklara"],
  ["Ottelukortin vihreä tausta tarkoittaa valitun painijan voittoa ja vaaleanpunainen tappiota. Epäselvä tulos näkyy neutraalina. Tulos kerrotaan myös tekstinä.", "A green bout card means a win for the selected wrestler and pink means a loss. Unresolved results have a neutral background. The result is also shown as text.", "En grön matchruta betyder vinst för den valda brottaren och rosa betyder förlust. Oklara resultat har neutral bakgrund. Resultatet visas också som text."],

  ["Lista näyttää enintään 50 ottelua kerrallaan. Yhteenveto sisältää kaikki hakuehtoja vastaavat ottelut.","The list shows up to 50 bouts at a time. The summary includes all bouts matching your filters.","Listan visar högst 50 matcher åt gången. Sammanfattningen omfattar alla matcher som matchar sökvillkoren."],
  [
    "Painijatulokset",
    "Wrestling results",
    "Brottningsresultat"
  ],
  [
    "Suomalaisten painijoiden tulokset",
    "Results of Finnish wrestlers",
    "Finländska brottares resultat"
  ],
  [
    "Sivuston näkymät",
    "Site views",
    "Sidans vyer"
  ],
  [
    "Tuloshaku",
    "Results search",
    "Resultatsökning"
  ],
  [
    "Kilpailut",
    "Competitions",
    "Tävlingar"
  ],
  [
    "Ottelut",
    "Bouts",
    "Matcher"
  ],
  [
    "Anna palautetta",
    "Send feedback",
    "Ge respons"
  ],
  [
    "Palaute näkyy sivuston ylläpitäjälle. Jätä henkilötiedot ja yhteystiedot pois.",
    "Feedback is visible to the site administrator. Do not include personal or contact details.",
    "Responsen visas för sidans administratör. Ta inte med person- eller kontaktuppgifter."
  ],
  [
    "Aihe",
    "Topic",
    "Ämne"
  ],
  [
    "Kehitysidea",
    "Suggestion",
    "Utvecklingsidé"
  ],
  [
    "Virhe sivustolla",
    "Site error",
    "Fel på sidan"
  ],
  [
    "Muu palaute",
    "Other feedback",
    "Övrig respons"
  ],
  [
    "Palaute",
    "Feedback",
    "Respons"
  ],
  [
    "Enintään 2 000 merkkiä.",
    "Up to 2,000 characters.",
    "Högst 2 000 tecken."
  ],
  [
    "Lähetä palaute",
    "Send feedback",
    "Skicka respons"
  ],
  [
    "Sulje",
    "Close",
    "Stäng"
  ],
  [
    "Hae painijan tuloksia nimellä ja rajaa niitä vuoden, painimuodon, kilpailun tai seuran mukaan.",
    "Search by wrestler name and filter by year, wrestling style, competition or club.",
    "Sök på brottarens namn och filtrera efter år, brottningsstil, tävling eller förening."
  ],
  [
    "Aineiston päivittäminen",
    "Updating the data",
    "Uppdatering av data"
  ],
  [
    "Tarkistetaan, onko uusia tietoja saatavilla…",
    "Checking for updates…",
    "Söker efter uppdateringar…"
  ],
  [
    "Päivitä tiedot",
    "Refresh data",
    "Uppdatera data"
  ],
  [
    "Kilpailu",
    "Competition",
    "Tävling"
  ],
  [
    "Hae kilpailun nimellä, paikalla tai vuodella…",
    "Search by competition, location or year…",
    "Sök på tävling, ort eller år…"
  ],
  [
    "Pienet kirjoitusvirheet sallitaan. Valitse kilpailu alla olevasta valikosta. Tyhjä haku näyttää kaikki kilpailut.",
    "Minor typos are allowed. Select a competition from the list below. An empty search shows all competitions.",
    "Små skrivfel tillåts. Välj en tävling i listan nedan. En tom sökning visar alla tävlingar."
  ],
  [
    "Sopivat kilpailut",
    "Matching competitions",
    "Matchande tävlingar"
  ],
  [
    "Painimuoto",
    "Wrestling style",
    "Brottningsstil"
  ],
  [
    "Kaikki painimuodot",
    "All wrestling styles",
    "Alla brottningsstilar"
  ],
  [
    "Kreikkalais-roomalainen",
    "Greco-Roman",
    "Grekisk-romersk"
  ],
  [
    "Vapaapaini",
    "Freestyle",
    "Fristil"
  ],
  [
    "Naispaini",
    "Women's wrestling",
    "Dambrottning"
  ],
  [
    "Ei vahvistettu",
    "Unconfirmed",
    "Ej bekräftad"
  ],
  [
    "Vuosi",
    "Year",
    "År"
  ],
  [
    "Tulosten järjestys",
    "Sort results",
    "Resultatordning"
  ],
  [
    "Uusimmat ensin",
    "Newest first",
    "Nyaste först"
  ],
  [
    "Vanhimmat ensin",
    "Oldest first",
    "Äldsta först"
  ],
  [
    "Paras sijoitus ensin",
    "Best placement first",
    "Bästa placering först"
  ],
  [
    "Arvokkuus: SM, KLL, alue, muut",
    "Importance: Finnish championships, KLL, regional, other",
    "Betydelse: FM, KLL, regionala, övriga"
  ],
  [
    "Painijan nimi",
    "Wrestler name",
    "Brottarens namn"
  ],
  [
    "Kirjoita nimi…",
    "Enter a name…",
    "Skriv ett namn…"
  ],
  [
    "Seura",
    "Club",
    "Förening"
  ],
  [
    "Ikäluokka",
    "Age group",
    "Åldersklass"
  ],
  [
    "Tyhjennä hakuehdot",
    "Clear filters",
    "Rensa sökvillkor"
  ],
  [
    "Tyhjentää hakuehdot ja palauttaa kaikki tulokset näkyviin. Tuloksia ei poisteta.",
    "Clears filters and shows all results. No results are deleted.",
    "Rensar sökvillkoren och visar alla resultat. Inga resultat raderas."
  ],
  [
    "Avaa painijan tulosnäkymä napsauttamalla hänen nimeään. Päivämäärättömät kilpailut ovat aikajärjestyksessä viimeisinä. Painijan omassa näkymässä näkyvät kaikkien vuosien tulokset.",
    "Click a wrestler's name to open their profile. Undated competitions appear last when sorted by date. The profile shows results from all years.",
    "Klicka på brottarens namn för att öppna profilen. Tävlingar utan datum visas sist i datumordning. Profilen visar resultat från alla år."
  ],
  [
    "Painimuoto perustuu lähdesivun sarjatietoon. Puuttuva tieto näkyy muodossa ”Ei vahvistettu”.",
    "Wrestling style is based on the source category. Missing information is shown as “Unconfirmed”.",
    "Brottningsstilen bygger på källans klassuppgifter. Saknad information visas som ”Ej bekräftad”."
  ],
  [
    "Ilmoita kilpailun tiedoissa olevasta virheestä",
    "Report an error in this competition",
    "Anmäl ett fel i tävlingsuppgifterna"
  ],
  [
    "Tulosaineiston kattavuus",
    "Results coverage",
    "Resultatens täckning"
  ],
  [
    "Kilpailutulokset",
    "Competition results",
    "Tävlingsresultat"
  ],
  [
    "Tuloslistan sivut ylhäällä",
    "Result pages, top",
    "Resultatsidor, överst"
  ],
  [
    "← Edellinen",
    "← Previous",
    "← Föregående"
  ],
  [
    "Seuraava →",
    "Next →",
    "Nästa →"
  ],
  [
    "Kilpailujen sijoitukset",
    "Competition placements",
    "Tävlingsplaceringar"
  ],
  [
    "Sija",
    "Place",
    "Placering"
  ],
  [
    "Painija",
    "Wrestler",
    "Brottare"
  ],
  [
    "Painoluokka",
    "Weight class",
    "Viktklass"
  ],
  [
    "Paikka ja aika",
    "Location and date",
    "Ort och datum"
  ],
  [
    "Tuloslistan sivut alhaalla",
    "Result pages, bottom",
    "Resultatsidor, nederst"
  ],
  [
    "Hakuehdoilla ei löytynyt tuloksia. Kokeile poistaa rajauksia.",
    "No results match your filters. Try removing some filters.",
    "Inga resultat matchar sökvillkoren. Prova att ta bort några filter."
  ],
  [
    "Etsi kilpailun nimellä, paikkakunnalla tai päivämäärällä. Tässä näkyvät sivuston kilpailuaineistoon kuuluvat kilpailut.",
    "Search by competition name, location or date. This list contains the competitions included on this site.",
    "Sök på tävlingens namn, ort eller datum. Här visas tävlingarna som ingår på sidan."
  ],
  [
    "Etsi kilpailua",
    "Find a competition",
    "Sök tävling"
  ],
  [
    "Esimerkiksi Tampere tai 2026…",
    "For example Tampere or 2026…",
    "Till exempel Tampere eller 2026…"
  ],
  [
    "Voit hakea nimellä, paikkakunnalla tai vuodella. Haku sietää pieniä kirjoitusvirheitä.",
    "Search by name, location or year. Minor typos are allowed.",
    "Sök på namn, ort eller år. Små skrivfel tillåts."
  ],
  [
    "Järjestys",
    "Sort order",
    "Sortering"
  ],
  [
    "Nimen mukaan",
    "By name",
    "Efter namn"
  ],
  [
    "Hakuehdoilla ei löytynyt kilpailuja. Kokeile toista hakusanaa.",
    "No competitions found. Try another search.",
    "Inga tävlingar hittades. Prova ett annat sökord."
  ],
  [
    "Laajeneva aineisto",
    "Growing collection",
    "Växande material"
  ],
  [
    "Hae painijan vastustajia ja ottelutuloksia tai vertaile kahden painijan keskinäisiä otteluita.",
    "Find opponents and bout results, or compare bouts between two wrestlers.",
    "Sök motståndare och matchresultat eller jämför inbördes matcher mellan två brottare."
  ],
  [
    "Ottelutietojen kattavuus",
    "Bout coverage",
    "Matchernas täckning"
  ],
  [
    "Avaa viimeisin otteluhaun raportti",
    "Open the latest bout collection report",
    "Öppna den senaste matchrapporten"
  ],
  [
    "Ladataan mukana olevien kilpailujen tietoja…",
    "Loading competition information…",
    "Laddar tävlingsuppgifter…"
  ],
  [
    "Ladataan ottelutietoja…",
    "Loading bouts…",
    "Laddar matcher…"
  ],
  [
    "Yritä otteluiden lataamista uudelleen",
    "Retry loading bouts",
    "Försök ladda matcherna igen"
  ],
  [
    "Mitä haluat tarkastella?",
    "What would you like to see?",
    "Vad vill du se?"
  ],
  [
    "Yhden painijan ottelut",
    "One wrestler's bouts",
    "En brottares matcher"
  ],
  [
    "Kahden painijan vertailu",
    "Compare two wrestlers",
    "Jämför två brottare"
  ],
  [
    "Kirjoita nimi ja valitse painija alle avautuvasta valikosta. Haku sietää pieniä kirjoitusvirheitä. Valikossa ovat mukana olevien kilpailujen painijat.",
    "Enter a name and select a wrestler from the list below. Minor typos are allowed. The list contains wrestlers from the included competitions.",
    "Skriv ett namn och välj en brottare i listan nedan. Små skrivfel tillåts. Listan innehåller brottare från de tävlingar som ingår."
  ],
  [
    "Kun ensimmäinen painija on valittu, ehdotamme ensin hänen aiempia vastustajiaan mukana olevasta aineistosta. Muut painijat löytyvät tarkemmalla nimellä. Tyhjennä hakukenttä nähdäksesi aiemmat vastustajat.",
    "After selecting the first wrestler, their previous opponents in this collection appear first. Use a more precise name to find other wrestlers. Clear the field to see previous opponents.",
    "När den första brottaren valts visas tidigare motståndare i materialet först. Sök med ett mer exakt namn för att hitta andra brottare. Töm fältet för att se tidigare motståndare."
  ],
  [
    "Kaikki mukana olevat kilpailut",
    "All included competitions",
    "Alla tävlingar som ingår"
  ],
  [
    "Hae painijan nimellä…",
    "Search by wrestler name…",
    "Sök på brottarens namn…"
  ],
  [
    "Painijan hakuehdotukset",
    "Wrestler suggestions",
    "Förslag på brottare"
  ],
  [
    "Vastustaja",
    "Opponent",
    "Motståndare"
  ],
  [
    "Hae vastustajan nimellä…",
    "Search by opponent name…",
    "Sök på motståndarens namn…"
  ],
  [
    "Vastustajan hakuehdotukset",
    "Opponent suggestions",
    "Förslag på motståndare"
  ],
  [
    "Vaihda painijat keskenään",
    "Swap wrestlers",
    "Byt plats på brottarna"
  ],
  [
    "Kokeile esimerkkiparia",
    "Try an example pair",
    "Prova ett exempelpar"
  ],
  [
    "Tyhjennä valinnat",
    "Clear selections",
    "Rensa val"
  ],
  [
    "Valitse painija",
    "Select a wrestler",
    "Välj en brottare"
  ],
  [
    "Valitse painija nähdäksesi mukana olevat ottelut.",
    "Select a wrestler to see included bouts.",
    "Välj en brottare för att se matcherna som ingår."
  ],
  [
    "Valittujen painijoiden ottelut",
    "Selected wrestlers' bouts",
    "De valda brottarnas matcher"
  ],
  [
    "Kierros",
    "Round",
    "Omgång"
  ],
  [
    "Valittu painija",
    "Selected wrestler",
    "Vald brottare"
  ],
  [
    "Valitun tulos",
    "Selected wrestler's result",
    "Den valda brottarens resultat"
  ],
  [
    "Voittotapa",
    "Victory method",
    "Segersätt"
  ],
  [
    "Pisteet, valittu–vastustaja",
    "Points, selected–opponent",
    "Poäng, vald–motståndare"
  ],
  [
    "Lähde",
    "Source",
    "Källa"
  ],
  [
    "Mukana olevat kilpailut ja kattavuus",
    "Included competitions and coverage",
    "Tävlingar som ingår och täckning"
  ],
  [
    "Aineistossa on osa vuosien 2022–2026 kilpailuista. Pois jätetyt ottelut eivät sisälly näkyviin voittoihin tai tappioihin. Lähderistiriidat, tunnistamattomat painijat ja tarkistettavat voittotavat jätetään ulkopuolelle.",
    "The collection covers some competitions from 2022–2026. Omitted bouts are not counted as wins or losses. Conflicting sources, unidentified wrestlers and unverified victory methods are excluded.",
    "Materialet omfattar en del av tävlingarna 2022–2026. Utelämnade matcher räknas inte som vinster eller förluster. Motstridiga källor, oidentifierade brottare och obekräftade segersätt utesluts."
  ],
  [
    "Voittotapa ja tekniset pisteet ovat eri asioita: selätysvoiton voi saada myös pienemmillä pisteillä. Puuttuvia pisteitä ei päätellä eikä korvata luvulla 0–0.",
    "Victory method and technical points are different: a wrestler can win by fall with fewer points. Missing points are never inferred or replaced with 0–0.",
    "Segersätt och tekniska poäng är olika saker: en brottare kan vinna på fall med färre poäng. Saknade poäng uppskattas inte och ersätts inte med 0–0."
  ],
  [
    "← Takaisin hakutuloksiin",
    "← Back to search results",
    "← Tillbaka till sökresultaten"
  ],
  [
    "Ilmoita painijan tiedoissa olevasta virheestä",
    "Report an error in this wrestler's data",
    "Anmäl ett fel i brottarens uppgifter"
  ],
  [
    "Linkki tähän painijanäkymään",
    "Link to this wrestler profile",
    "Länk till brottarprofilen"
  ],
  [
    "Kopioi painijan linkki",
    "Copy profile link",
    "Kopiera profillänken"
  ],
  [
    "Tulokset on liitetty sivuston omaan pysyvään tunnukseen. Alkuperäiset nimi–seura-ryhmät ovat tarkistamattomia: samaan ryhmään voi kuulua samannimisiä henkilöitä. Ylläpito voi yhdistää tai erottaa merkintöjä tarkistuksen jälkeen.",
    "Results are linked to a permanent site identifier. Original name–club groups are unverified and may contain different people with the same name. Administrators can merge or separate entries after review.",
    "Resultaten är kopplade till ett permanent ID på sidan. Ursprungliga namn–föreningsgrupper är obekräftade och kan innehålla olika personer med samma namn. Administratören kan slå ihop eller skilja poster efter granskning."
  ],
  [
    "Näytä tulokset vuodelta",
    "Show results for year",
    "Visa resultat för år"
  ],
  [
    "Kaikki vuodet",
    "All years",
    "Alla år"
  ],
  [
    "Sijoitusten jakauma",
    "Placement distribution",
    "Fördelning av placeringar"
  ],
  [
    "Jokainen tulosrivi lasketaan kerran. Muut sijoitukset tarkoittavat sijoja 4 ja siitä eteenpäin.",
    "Each result row is counted once. Other placements means fourth place and below.",
    "Varje resultatrad räknas en gång. Övriga placeringar avser fjärde plats och lägre."
  ],
  [
    "tulosta",
    "results",
    "resultat"
  ],
  [
    "Ei tuloksia kuvaajaa varten.",
    "No results for the chart.",
    "Inga resultat för diagrammet."
  ],
  [
    "Sijoitukset vuosittain",
    "Placements by year",
    "Placeringar per år"
  ],
  [
    "Kaikkien vuosien tulosrivit. Värit: kulta = 1., hopea = 2., pronssi = 3., sininen = muut sijoitukset. Tarkat luvut ovat taulukossa.",
    "Result rows from all years. Colours: gold = first, silver = second, bronze = third, blue = other placements. Exact figures are in the table.",
    "Resultatrader från alla år. Färger: guld = första, silver = andra, brons = tredje, blått = övriga placeringar. Exakta tal finns i tabellen."
  ],
  [
    "Näytä vuosittaiset luvut",
    "Show yearly figures",
    "Visa årliga siffror"
  ],
  [
    "1. sija",
    "1st place",
    "1:a plats"
  ],
  [
    "2. sija",
    "2nd place",
    "2:a plats"
  ],
  [
    "3. sija",
    "3rd place",
    "3:e plats"
  ],
  [
    "Muut sijoitukset",
    "Other placements",
    "Övriga placeringar"
  ],
  [
    "Yhteensä",
    "Total",
    "Totalt"
  ],
  [
    "Samannimisiä erillisiä merkintöjä",
    "Separate entries with the same name",
    "Separata poster med samma namn"
  ],
  [
    "Näitä merkintöjä ei ole yhdistetty tähän tunnukseen. Kyseessä voi olla eri henkilö tai vahvistamaton seuranvaihdos.",
    "These entries have not been merged into this identifier. They may be a different person or an unverified club change.",
    "Dessa poster har inte kopplats till detta ID. Det kan vara en annan person eller ett obekräftat föreningsbyte."
  ],
  [
    "Kaikki tämän nimen ja seuran tulokset",
    "All results linked to this profile",
    "Alla resultat kopplade till profilen"
  ],
  [
    "Päivämäärättömät kilpailut ovat aikajärjestyksessä lopussa. Arvokkuus perustuu kilpailun nimeen: SM, KLL, alue- ja piirinmestaruudet, muut.",
    "Undated competitions appear last when sorted by date. Importance is based on the title: Finnish championships, KLL, regional and district championships, other.",
    "Tävlingar utan datum visas sist i datumordning. Betydelsen bygger på namnet: FM, KLL, region- och distriktsmästerskap, övriga."
  ],
  [
    "Valitun nimen ja seuran kilpailutulokset",
    "Results linked to the selected profile",
    "Resultat kopplade till den valda profilen"
  ],
  [
    "Tälle nimelle ja seuralle ei enää löydy tuloksia nykyisestä aineistosta.",
    "No results remain for this profile in the current data.",
    "Inga resultat finns längre för profilen i aktuella data."
  ],
  [
    "Aineiston päivitystiedot",
    "Data update information",
    "Information om datauppdateringar"
  ],
  [
    "Luetaan aineiston päivitystietoja…",
    "Loading update information…",
    "Laddar uppdateringsinformation…"
  ],
  [
    "Lähde: RingerDB / LigaDB. Tulokset ovat tallennettuja kilpailutuloksia. Aineistoa tarkistetaan ajastetusti.",
    "Source: RingerDB / LigaDB. These are stored competition results. The collection is checked on a schedule.",
    "Källa: RingerDB / LigaDB. Resultaten är sparade tävlingsresultat. Materialet kontrolleras enligt ett schema."
  ],
  [
    "Tämä sivu tarvitsee JavaScriptin.",
    "This page requires JavaScript.",
    "Den här sidan kräver JavaScript."
  ],
  [
    "Kaikki kilpailut",
    "All competitions",
    "Alla tävlingar"
  ],
  [
    "Kaikki seurat",
    "All clubs",
    "Alla föreningar"
  ],
  [
    "Kaikki ikäluokat",
    "All age groups",
    "Alla åldersklasser"
  ],
  [
    "Ei päivämäärää",
    "Undated",
    "Utan datum"
  ],
  [
    "Kilpailuja",
    "Competitions",
    "Tävlingar"
  ],
  [
    "Tulosrivejä",
    "Result rows",
    "Resultatrader"
  ],
  [
    "1. sijoja",
    "First places",
    "Förstaplatser"
  ],
  [
    "2. sijoja",
    "Second places",
    "Andraplatser"
  ],
  [
    "3. sijoja",
    "Third places",
    "Tredjeplatser"
  ],
  [
    "Voitot (1. sija)",
    "Wins (1st place)",
    "Segrar (1:a plats)"
  ],
  [
    "Näytä tulokset",
    "Show results",
    "Visa resultat"
  ],
  [
    "Sivuston kilpailuaineisto",
    "Site competition collection",
    "Sidans tävlingsmaterial"
  ],
  [
    "Alkuperäinen tulossivu ↗",
    "Original results page ↗",
    "Ursprunglig resultatsida ↗"
  ],
  [
    "Avaa alkuperäinen tulossivu ↗",
    "Open original results page ↗",
    "Öppna ursprunglig resultatsida ↗"
  ],
  [
    "Tulossivu ↗",
    "Results page ↗",
    "Resultatsida ↗"
  ],
  [
    "Ottelulista ↗",
    "Bout list ↗",
    "Matchlista ↗"
  ],
  [
    "Avaa lähde ↗",
    "Open source ↗",
    "Öppna källa ↗"
  ],
  [
    "Voitto",
    "Win",
    "Vinst"
  ],
  [
    "Tappio",
    "Loss",
    "Förlust"
  ],
  [
    "Voitot",
    "Wins",
    "Vinster"
  ],
  [
    "Tappiot",
    "Losses",
    "Förluster"
  ],
  [
    "Otteluita",
    "Bouts",
    "Matcher"
  ],
  [
    "Voittoprosentti",
    "Win percentage",
    "Vinstprocent"
  ],
  [
    "Pistevoitto",
    "Win by points",
    "Poängseger"
  ],
  [
    "Ylivoimainen pistevoitto",
    "Technical superiority",
    "Teknisk överlägsenhet"
  ],
  [
    "Selätys",
    "Fall",
    "Fall"
  ],
  [
    "Voitto vastustajan loukkaantumisen vuoksi",
    "Win due to opponent injury",
    "Seger på grund av motståndarens skada"
  ],
  [
    "Valitse myös vastustaja keskinäistä vertailua varten.",
    "Select an opponent for a head-to-head comparison.",
    "Välj även en motståndare för en inbördes jämförelse."
  ],
  [
    "Valitse kaksi eri painijaa",
    "Select two different wrestlers",
    "Välj två olika brottare"
  ],
  [
    "Painijaa ei voi verrata itseensä. Valitse toinen vastustaja.",
    "A wrestler cannot be compared with themselves. Select a different opponent.",
    "En brottare kan inte jämföras med sig själv. Välj en annan motståndare."
  ],
  [
    "Valinnalla ei löytynyt aineistoon mukaan otettuja otteluita. Tämä ei tarkoita, etteivät painijat olisi koskaan kohdanneet.",
    "No included bouts match this selection. This does not mean the wrestlers have never met.",
    "Inga matcher i materialet matchar valet. Det betyder inte att brottarna aldrig har mötts."
  ],
  [
    "Tälle painijalle ei löytynyt mukaan otettuja otteluita valituista kilpailuista. Muiden kilpailujen ottelut eivät vielä ole mukana.",
    "No included bouts were found for this wrestler in the selected competitions. Bouts from other competitions are not yet included.",
    "Inga matcher hittades för brottaren i de valda tävlingarna. Matcher från andra tävlingar ingår ännu inte."
  ],
  [
    "Ei keskinäisiä otteluita tässä aineistossa",
    "No head-to-head bouts in this collection",
    "Inga inbördes matcher i materialet"
  ],
  [
    "Kilpailurajaus päivitetty.",
    "Competition filter updated.",
    "Tävlingsfiltret uppdaterat."
  ],
  [
    "Painijat vaihdettu keskenään.",
    "Wrestlers swapped.",
    "Brottarna har bytt plats."
  ],
  [
    "Valinnat tyhjennetty.",
    "Selections cleared.",
    "Valen rensade."
  ],
  [
    "Esimerkkipari valittu.",
    "Example pair selected.",
    "Exempelpar valt."
  ],
  [
    "Linkki kopioitu.",
    "Link copied.",
    "Länken kopierad."
  ],
  [
    "Ylläpito tarkistanut yhdistämisen",
    "Merge reviewed by administrator",
    "Sammanslagningen granskad av administratören"
  ],
  [
    "Tarkistamaton tulosryhmä",
    "Unreviewed result group",
    "Ogranskad resultatgrupp"
  ],
  [
    "Nimet lähdetuloksissa:",
    "Names in source results:",
    "Namn i källresultaten:"
  ],
  [
    "Seurat tuloksissa:",
    "Clubs in results:",
    "Föreningar i resultaten:"
  ],
  [
    "Kaikkien vuosien tulokset.",
    "Results from all years.",
    "Resultat från alla år."
  ],
  [
    "Tulokset ilman tunnistettua päivämäärää.",
    "Results without a recognised date.",
    "Resultat utan identifierat datum."
  ],
  [
    "Yhteenveto, sijoitusten jakauma ja tuloslista koskevat valittua vuotta. Päähaun rajaukset eivät vaikuta tähän näkymään.",
    "The summary, placement distribution and results list cover the selected year. Main search filters do not affect this view.",
    "Sammanfattningen, placeringsfördelningen och resultatlistan gäller det valda året. Huvudsökningens filter påverkar inte denna vy."
  ],
  [
    "Osittaiset tulokset",
    "Partial results",
    "Delvisa resultat"
  ],
  [
    "Ladataan tuloksia…",
    "Loading results…",
    "Laddar resultat…"
  ],
  [
    "Käytössä on uusin tarkistettu aineisto. Tarkistettu",
    "The latest checked data is loaded. Checked",
    "De senast kontrollerade uppgifterna används. Kontrollerat"
  ],
  [
    "Tarkistettu",
    "Checked",
    "Kontrollerat"
  ],
  [
    "Viimeisin otteluhaku",
    "Latest bout collection",
    "Senaste matchinsamling"
  ],
  [
    "Aineistotiedosto tallennettu:",
    "Data file saved:",
    "Datafilen sparad:"
  ],
  [
    "Automaattihaku tarkistettu:",
    "Automatic collection checked:",
    "Automatisk insamling kontrollerad:"
  ],
  [
    "Voittoja",
    "Wins",
    "Vinster"
  ],
  [
    "Tappioita",
    "Losses",
    "Förluster"
  ],
  [
    "Pisteitä ei ilmoitettu",
    "Points not reported",
    "Poäng har inte angetts"
  ],
  [
    "Erota samannimiset",
    "Separate namesakes",
    "Skilj personer med samma namn"
  ],
  [
    "Erota henkilöt",
    "Separate people",
    "Skilj personer"
  ],
  [
    "Tulokset osittaiset",
    "Partial results",
    "Delvisa resultat"
  ],
  [
    "Poista kilpailurajaus",
    "Clear competition filter",
    "Ta bort tävlingsfilter"
  ],
  [
    "Valittuna:",
    "Selected:",
    "Vald:"
  ],
  [
    "Kilpailuja ei löytynyt. Kokeile lyhyempää hakua tai pelkkää paikkakuntaa.",
    "No competitions found. Try a shorter search or just a location.",
    "Inga tävlingar hittades. Prova en kortare sökning eller endast orten."
  ],
  [
    "Nimellä ei löytynyt ehdotuksia. Kokeile lyhyempää hakua tai eri kirjoitusasua.",
    "No name suggestions found. Try a shorter search or different spelling.",
    "Inga namnförslag hittades. Prova en kortare sökning eller annan stavning."
  ],
  [
    "Nimellä ei löytynyt ehdotuksia. Muista painijoista kirjoita nimi tai vähintään kolme kirjainta nimen alusta.",
    "No suggestions found. For other wrestlers, enter a name or at least its first three letters.",
    "Inga förslag hittades. För andra brottare, skriv namnet eller minst de tre första bokstäverna."
  ],
  [
    "Aiemmin valittua painijaa ei löydy päivitetystä otteluaineistosta. Valitse painija uudelleen.",
    "The previously selected wrestler is missing from the updated bout data. Select a wrestler again.",
    "Den tidigare valda brottaren saknas i uppdaterade matchdata. Välj en brottare igen."
  ],
  [
    "Aiempi kilpailurajaus ei ole saatavilla. Näytetään kaikki mukana olevat kilpailut.",
    "The previous competition filter is unavailable. Showing all included competitions.",
    "Det tidigare tävlingsfiltret är inte tillgängligt. Alla tävlingar som ingår visas."
  ],
  [
    "Tämä luettelo koskee kaikkia vuosia 2022–2026. Viimeisimmän haun yhteenveto voi koskea vain yhtä vuotta. Mukana olevista kilpailuistakin voi puuttua yksittäisiä otteluita.",
    "This list covers all years 2022–2026. The latest collection summary may cover only one year. Individual bouts may also be missing from included competitions.",
    "Listan gäller alla år 2022–2026. Den senaste insamlingens sammanfattning kan gälla endast ett år. Enskilda matcher kan saknas även från tävlingar som ingår."
  ],
  [
    "Kilpailussa on puutteellisia tai tarkistettavia tietoja. Alla näkyy, mitä on tuotu ja mitä on jätetty pois. Puuttuvia sijoituksia ei ole päätelty:",
    "This competition has incomplete or unverified information. Imported and omitted results are listed below. Missing placements have not been inferred:",
    "Tävlingen har ofullständiga eller obekräftade uppgifter. Importerade och utelämnade resultat visas nedan. Saknade placeringar har inte uppskattats:"
  ],
  [
    "Tuotuja sijoituksia:",
    "Imported placements:",
    "Importerade placeringar:"
  ],
  [
    "tuomatta jääneitä osallistujia:",
    "participants not imported:",
    "deltagare som inte importerats:"
  ],
  [
    "Painoluokka on jätetty pois tuonnista.",
    "This weight class was not imported.",
    "Viktklassen importerades inte."
  ],
  [
    "Kaikille osallistujille ei löytynyt vahvistettua sijoitusta.",
    "Confirmed placements were not found for all participants.",
    "Bekräftade placeringar hittades inte för alla deltagare."
  ],
  [
    "Lähteessä on vain osallistujalistat, ei vahvistettuja tuloksia",
    "The source contains only entry lists, not confirmed results",
    "Källan innehåller endast deltagarlistor, inga bekräftade resultat"
  ],
  [
    "Tulosluetteloissa ei ole vielä vahvistettuja sijoituksia",
    "The results lists do not yet contain confirmed placements",
    "Resultatlistorna innehåller ännu inga bekräftade placeringar"
  ],
  [
    "Alkuperäinen tulossivu:",
    "Original results page:",
    "Ursprunglig resultatsida:"
  ],
  [
    "Näytä tulokset:",
    "Show results:",
    "Visa resultat:"
  ],
  [
    "Avaa lähde:",
    "Open source:",
    "Öppna källa:"
  ],
  [
    "Linkki kopioitu leikepöydälle.",
    "Link copied to clipboard.",
    "Länken kopierad till urklipp."
  ],
  [
    "Kopiointi ei onnistunut. Voit kopioida linkin yllä olevasta kentästä.",
    "Copy failed. You can copy the link from the field above.",
    "Kopieringen misslyckades. Du kan kopiera länken från fältet ovan."
  ],
  [
    "Uusi aineisto löytyi. Päivitetään tuloksia…",
    "New data found. Refreshing results…",
    "Nya data hittades. Uppdaterar resultaten…"
  ],
  [
    "Päivityksiä ei voitu tarkistaa. Voit yrittää ladata uusimman sivun Päivitä tiedot -painikkeesta.",
    "Updates could not be checked. Use Refresh data to try loading the latest page.",
    "Uppdateringar kunde inte kontrolleras. Prova knappen Uppdatera data för att ladda den senaste sidan."
  ],
  [
    "Ladataan ottelukokeilua…",
    "Loading bouts…",
    "Laddar matcher…"
  ],
  [
    "Ottelukokeilua ei voitu avata. Tarkista verkkoyhteys ja että käytössä on uusin sivuversio. Tuloshaku toimii edelleen.",
    "Bouts could not be opened. Check your connection and that the page is up to date. Results search is still available.",
    "Matcherna kunde inte öppnas. Kontrollera anslutningen och att sidan är uppdaterad. Resultatsökningen fungerar fortfarande."
  ],
  [
    "Päivämäärää ja paikkaa ei tunnistettu.",
    "Date and location not recognised.",
    "Datum och ort kunde inte identifieras."
  ],
  [
    "Osa painoluokista puuttuu. Näytä tulokset nähdäksesi puuttuvat luokat.",
    "Some weight classes are missing. Open results to see which classes are missing.",
    "Vissa viktklasser saknas. Öppna resultaten för att se vilka klasser som saknas."
  ],
  [
    "Kilpailuaineisto ei latautunut. Päivitä sivu tai kokeile myöhemmin uudelleen.",
    "Competition data could not be loaded. Refresh the page or try again later.",
    "Tävlingsdata kunde inte laddas. Uppdatera sidan eller försök igen senare."
  ],
  [
    "Linkin kilpailua ei löytynyt. Voit etsiä sitä kilpailun nimellä.",
    "The linked competition was not found. Search for it by name.",
    "Den länkade tävlingen hittades inte. Sök på tävlingens namn."
  ],
  [
    "Linkin painijatunnusta ei löytynyt tästä aineistosta. Voit etsiä painijaa nimellä tai avata toisen linkin.",
    "The linked wrestler ID was not found in this collection. Search by name or open another link.",
    "Det länkade brottar-ID:t hittades inte i materialet. Sök på namn eller öppna en annan länk."
  ],
  [
    "Painijan linkki kopioitu. Voit liittää sen viestiin.",
    "Profile link copied. You can paste it into a message.",
    "Profillänken kopierad. Du kan klistra in den i ett meddelande."
  ],
  [
    "Kopioi valittu osoite käsin ja liitä se viestiin.",
    "Copy the selected address manually and paste it into a message.",
    "Kopiera den valda adressen manuellt och klistra in den i ett meddelande."
  ],
  [
    "Kilpailusta puuttuvat:",
    "Missing from competition:",
    "Saknas från tävlingen:"
  ],
  [
    "Katso alkuperäinen tulossivu ↗",
    "View original results page ↗",
    "Visa ursprunglig resultatsida ↗"
  ],
  [
    "Nimellä ei löytynyt painijaa valituista kilpailuista.",
    "No wrestler with that name was found in the selected competitions.",
    "Ingen brottare med namnet hittades i de valda tävlingarna."
  ],
  [
    "Ilmoitus koskee:",
    "Report concerns:",
    "Anmälan gäller:"
  ],
  [
    "Lähetetään palautetta…",
    "Sending feedback…",
    "Skickar respons…"
  ],
  [
    "Kiitos! Palautteesi on lähetetty.",
    "Thank you! Your feedback has been sent.",
    "Tack! Din respons har skickats."
  ],
  [
    "Palautteita on lähetetty paljon. Kokeile hetken kuluttua uudelleen.",
    "Too many feedback submissions. Please try again shortly.",
    "Många responsmeddelanden har skickats. Försök igen om en stund."
  ],
  [
    "Palautteen lähettämistä ei voitu vahvistaa. Teksti säilyi lomakkeessa, ja voit yrittää uudelleen.",
    "Feedback submission could not be confirmed. Your text remains in the form so you can try again.",
    "Det gick inte att bekräfta att responsen skickats. Texten finns kvar i formuläret så att du kan försöka igen."
  ],
  [
    "Hakutiedot päivittyvät julkaisun valmistuttua.",
    "Collection information will update when publication is complete.",
    "Insamlingsinformationen uppdateras när publiceringen är klar."
  ],
  [
    "Uusi aineisto on saatavilla. Paina sivun yläosan Päivitä tiedot -painiketta.",
    "New data is available. Use Refresh data at the top of the page.",
    "Nya data finns tillgängliga. Använd Uppdatera data överst på sidan."
  ],
  [
    "Päivitysten tarkistus ei latautunut. Voit silti käyttää Päivitä tiedot -painiketta.",
    "The update check could not be loaded. You can still use Refresh data.",
    "Uppdateringskontrollen kunde inte laddas. Du kan ändå använda Uppdatera data."
  ],
  [
    "ei tiedossa",
    "unknown",
    "okänt"
  ]
];
if(typeof module!=="undefined"&&module.exports)module.exports=PAINI_TRANSLATIONS;
else window.PAINI_TRANSLATIONS=PAINI_TRANSLATIONS;
