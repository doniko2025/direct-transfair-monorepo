//apps/direct-transfair-mobile/data/cities.ts
// Ce fichier associe le nom du pays (tel qu'écrit dans countries.ts) à une liste de villes.
export const citiesByCountry: Record<string, string[]> = {
    "France": [
        "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", 
        "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes", "Trappes"
    ],
    "Sénégal": [
        "Dakar", "Touba", "Thiès", "Saint-Louis", "Ziguinchor", "Diourbel", 
        "Louga", "Tambacounda", "Kolda", "Mbour", "Fatick"
    ],
    "Mali": [
        "Bamako", "Sikasso", "Mopti", "Koutiala", "Kayes", "Ségou", 
        "Kati", "Gao", "Tombouctou"
    ],
    "Côte d'Ivoire": [
        "Abidjan", "Bouaké", "Daloa", "Yamoussoukro", "San-Pédro", 
        "Korhogo", "Man", "Gagnoa"
    ],
    "Guinée": [
        "Conakry", "Nzérékoré", "Kankan", "Kindia", "Labé", 
        "Mamou", "Boké", "Guéckédou"
    ],
    "Cameroun": [
        "Douala", "Yaoundé", "Garoua", "Bamenda", "Maroua", 
        "Bafoussam", "Ngaoundéré"
    ],
    "Maroc": [
        "Casablanca", "Rabat", "Fès", "Tanger", "Marrakech", 
        "Agadir", "Meknès", "Oujda"
    ],
    "Tunisie": [
        "Tunis", "Sfax", "Sousse", "Kairouan", "Bizerte", "Gabès"
    ],
    "Algérie": [
        "Alger", "Oran", "Constantine", "Annaba", "Blida", "Batna"
    ]
};