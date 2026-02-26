/**
 * Travel safety data for the Travel Safety Checker.
 * Advisory levels match U.S. Department of State: 1 = Normal, 2 = Caution, 3 = Reconsider, 4 = Do Not Travel.
 * For latest advisories, users are directed to travel.state.gov.
 */

export type AdvisoryLevel = 1 | 2 | 3 | 4;

export interface CountryAdvisory {
  name: string;
  level: AdvisoryLevel;
  summary?: string;
}

/** Sample country advisories — real-time data is at travel.state.gov. This is illustrative. */
export const COUNTRY_ADVISORIES: CountryAdvisory[] = [
  { name: "Canada", level: 1, summary: "Exercise normal precautions." },
  { name: "United Kingdom", level: 1 },
  { name: "France", level: 1 },
  { name: "Germany", level: 1 },
  { name: "Japan", level: 1 },
  { name: "South Korea", level: 1 },
  { name: "Australia", level: 1 },
  { name: "Spain", level: 1 },
  { name: "Italy", level: 1 },
  { name: "Portugal", level: 1 },
  { name: "Ireland", level: 1 },
  { name: "Netherlands", level: 1 },
  { name: "Belgium", level: 1 },
  { name: "Switzerland", level: 1 },
  { name: "Austria", level: 1 },
  { name: "Singapore", level: 1 },
  { name: "New Zealand", level: 1 },
  { name: "Costa Rica", level: 1 },
  { name: "Chile", level: 1 },
  { name: "Uruguay", level: 1 },
  { name: "United Arab Emirates", level: 1 },
  { name: "Qatar", level: 1 },
  { name: "Bahrain", level: 1 },
  { name: "Oman", level: 1 },
  { name: "India", level: 2, summary: "Exercise increased caution. Check local advisories." },
  { name: "Mexico", level: 2 },
  { name: "Brazil", level: 2 },
  { name: "Colombia", level: 2 },
  { name: "Philippines", level: 2 },
  { name: "Vietnam", level: 2 },
  { name: "Thailand", level: 2 },
  { name: "Indonesia", level: 2 },
  { name: "Pakistan", level: 3, summary: "Reconsider travel. Some areas Level 4." },
  { name: "Bangladesh", level: 2 },
  { name: "Egypt", level: 2 },
  { name: "South Africa", level: 2 },
  { name: "Nigeria", level: 3 },
  { name: "Jamaica", level: 2 },
  { name: "Dominican Republic", level: 2 },
  { name: "Haiti", level: 4, summary: "Do not travel." },
  { name: "Ukraine", level: 4 },
  { name: "Russia", level: 4 },
  { name: "Syria", level: 4 },
  { name: "Afghanistan", level: 4 },
  { name: "Iran", level: 4 },
  { name: "Iraq", level: 4 },
  { name: "Libya", level: 4 },
  { name: "Yemen", level: 4 },
  { name: "Somalia", level: 4 },
  { name: "Venezuela", level: 4 },
  { name: "Myanmar", level: 4 },
  { name: "Nepal", level: 2 },
  { name: "Sri Lanka", level: 2 },
  { name: "Cambodia", level: 2 },
  { name: "Malaysia", level: 1 },
  { name: "Argentina", level: 1 },
  { name: "Peru", level: 2 },
  { name: "Ecuador", level: 2 },
  { name: "Turkey", level: 2 },
  { name: "Israel", level: 2 },
  { name: "Jordan", level: 2 },
  { name: "Morocco", level: 2 },
  { name: "Kenya", level: 2 },
  { name: "Ghana", level: 2 },
  { name: "Ethiopia", level: 3 },
  { name: "China", level: 3 },
  { name: "Cuba", level: 2 },
  { name: "Poland", level: 1 },
  { name: "Czech Republic", level: 1 },
  { name: "Hungary", level: 1 },
  { name: "Romania", level: 1 },
  { name: "Greece", level: 1 },
  { name: "Croatia", level: 1 },
  { name: "El Salvador", level: 2 },
  { name: "Guatemala", level: 2 },
  { name: "Honduras", level: 2 },
  { name: "Nicaragua", level: 3 },
  { name: "Panama", level: 2 },
];

export interface AirportInfo {
  code: string;
  name: string;
  city: string;
  country: string;
  tier: "major" | "regional" | "small"; // affects transit safety score
}

/** Major US airports — common departure points for international travel */
export const US_AIRPORTS: AirportInfo[] = [
  { code: "JFK", name: "John F. Kennedy International", city: "New York", country: "United States", tier: "major" },
  { code: "EWR", name: "Newark Liberty International", city: "Newark", country: "United States", tier: "major" },
  { code: "LAX", name: "Los Angeles International", city: "Los Angeles", country: "United States", tier: "major" },
  { code: "ORD", name: "O'Hare International", city: "Chicago", country: "United States", tier: "major" },
  { code: "MIA", name: "Miami International", city: "Miami", country: "United States", tier: "major" },
  { code: "SFO", name: "San Francisco International", city: "San Francisco", country: "United States", tier: "major" },
  { code: "ATL", name: "Hartsfield-Jackson Atlanta International", city: "Atlanta", country: "United States", tier: "major" },
  { code: "DFW", name: "Dallas/Fort Worth International", city: "Dallas", country: "United States", tier: "major" },
  { code: "SEA", name: "Seattle-Tacoma International", city: "Seattle", country: "United States", tier: "major" },
  { code: "BOS", name: "Boston Logan International", city: "Boston", country: "United States", tier: "major" },
  { code: "IAD", name: "Washington Dulles International", city: "Washington", country: "United States", tier: "major" },
  { code: "IAH", name: "George Bush Intercontinental", city: "Houston", country: "United States", tier: "major" },
  { code: "DEN", name: "Denver International", city: "Denver", country: "United States", tier: "major" },
  { code: "PHX", name: "Phoenix Sky Harbor International", city: "Phoenix", country: "United States", tier: "major" },
  { code: "MCO", name: "Orlando International", city: "Orlando", country: "United States", tier: "major" },
  { code: "DTW", name: "Detroit Metropolitan", city: "Detroit", country: "United States", tier: "major" },
  { code: "MSP", name: "Minneapolis-Saint Paul International", city: "Minneapolis", country: "United States", tier: "major" },
  { code: "PHL", name: "Philadelphia International", city: "Philadelphia", country: "United States", tier: "regional" },
  { code: "BWI", name: "Baltimore-Washington International", city: "Baltimore", country: "United States", tier: "regional" },
  { code: "DCA", name: "Ronald Reagan Washington National", city: "Washington", country: "United States", tier: "regional" },
  { code: "SJC", name: "Norman Y. Mineta San Jose International", city: "San Jose", country: "United States", tier: "regional" },
  { code: "AUS", name: "Austin-Bergstrom International", city: "Austin", country: "United States", tier: "regional" },
];

/** International airports — by country. All major destinations included. */
export const INTERNATIONAL_AIRPORTS: AirportInfo[] = [
  // United Kingdom
  { code: "LHR", name: "Heathrow", city: "London", country: "United Kingdom", tier: "major" },
  { code: "LGW", name: "Gatwick", city: "London", country: "United Kingdom", tier: "major" },
  { code: "MAN", name: "Manchester", city: "Manchester", country: "United Kingdom", tier: "regional" },
  { code: "BHX", name: "Birmingham", city: "Birmingham", country: "United Kingdom", tier: "regional" },
  { code: "EDI", name: "Edinburgh", city: "Edinburgh", country: "United Kingdom", tier: "regional" },
  { code: "GLA", name: "Glasgow", city: "Glasgow", country: "United Kingdom", tier: "regional" },
  // France
  { code: "CDG", name: "Charles de Gaulle", city: "Paris", country: "France", tier: "major" },
  { code: "ORY", name: "Orly", city: "Paris", country: "France", tier: "major" },
  { code: "LYS", name: "Lyon-Saint Exupéry", city: "Lyon", country: "France", tier: "regional" },
  { code: "MRS", name: "Marseille Provence", city: "Marseille", country: "France", tier: "regional" },
  { code: "NCE", name: "Nice Côte d'Azur", city: "Nice", country: "France", tier: "regional" },
  // Germany
  { code: "FRA", name: "Frankfurt", city: "Frankfurt", country: "Germany", tier: "major" },
  { code: "MUC", name: "Munich", city: "Munich", country: "Germany", tier: "major" },
  { code: "TXL", name: "Berlin Brandenburg", city: "Berlin", country: "Germany", tier: "major" },
  { code: "DUS", name: "Düsseldorf", city: "Düsseldorf", country: "Germany", tier: "regional" },
  { code: "HAM", name: "Hamburg", city: "Hamburg", country: "Germany", tier: "regional" },
  { code: "CGN", name: "Cologne Bonn", city: "Cologne", country: "Germany", tier: "regional" },
  // Netherlands
  { code: "AMS", name: "Schiphol", city: "Amsterdam", country: "Netherlands", tier: "major" },
  { code: "RTM", name: "Rotterdam The Hague", city: "Rotterdam", country: "Netherlands", tier: "regional" },
  // UAE
  { code: "DXB", name: "Dubai International", city: "Dubai", country: "United Arab Emirates", tier: "major" },
  { code: "AUH", name: "Abu Dhabi International", city: "Abu Dhabi", country: "United Arab Emirates", tier: "major" },
  { code: "SHJ", name: "Sharjah International", city: "Sharjah", country: "United Arab Emirates", tier: "regional" },
  // Japan
  { code: "NRT", name: "Narita", city: "Tokyo", country: "Japan", tier: "major" },
  { code: "HND", name: "Haneda", city: "Tokyo", country: "Japan", tier: "major" },
  { code: "KIX", name: "Kansai", city: "Osaka", country: "Japan", tier: "major" },
  { code: "NGO", name: "Chubu Centrair", city: "Nagoya", country: "Japan", tier: "regional" },
  { code: "FUK", name: "Fukuoka", city: "Fukuoka", country: "Japan", tier: "regional" },
  // South Korea
  { code: "ICN", name: "Incheon", city: "Seoul", country: "South Korea", tier: "major" },
  { code: "GMP", name: "Gimpo", city: "Seoul", country: "South Korea", tier: "regional" },
  { code: "PUS", name: "Gimhae", city: "Busan", country: "South Korea", tier: "regional" },
  // Singapore
  { code: "SIN", name: "Changi", city: "Singapore", country: "Singapore", tier: "major" },
  // China
  { code: "HKG", name: "Hong Kong International", city: "Hong Kong", country: "China", tier: "major" },
  { code: "PVG", name: "Shanghai Pudong", city: "Shanghai", country: "China", tier: "major" },
  { code: "PEK", name: "Beijing Capital", city: "Beijing", country: "China", tier: "major" },
  { code: "CAN", name: "Guangzhou Baiyun", city: "Guangzhou", country: "China", tier: "major" },
  { code: "CTU", name: "Chengdu Shuangliu", city: "Chengdu", country: "China", tier: "regional" },
  // Canada
  { code: "YYZ", name: "Toronto Pearson", city: "Toronto", country: "Canada", tier: "major" },
  { code: "YVR", name: "Vancouver International", city: "Vancouver", country: "Canada", tier: "major" },
  { code: "YUL", name: "Montréal-Trudeau", city: "Montréal", country: "Canada", tier: "major" },
  { code: "YYC", name: "Calgary International", city: "Calgary", country: "Canada", tier: "regional" },
  { code: "YOW", name: "Ottawa Macdonald-Cartier", city: "Ottawa", country: "Canada", tier: "regional" },
  // Mexico
  { code: "MEX", name: "Benito Juárez", city: "Mexico City", country: "Mexico", tier: "major" },
  { code: "CUN", name: "Cancún International", city: "Cancún", country: "Mexico", tier: "major" },
  { code: "GDL", name: "Miguel Hidalgo", city: "Guadalajara", country: "Mexico", tier: "major" },
  { code: "MTY", name: "Mariano Escobedo", city: "Monterrey", country: "Mexico", tier: "major" },
  { code: "TIJ", name: "Tijuana", city: "Tijuana", country: "Mexico", tier: "regional" },
  { code: "SJD", name: "Los Cabos", city: "San José del Cabo", country: "Mexico", tier: "regional" },
  // India
  { code: "DEL", name: "Indira Gandhi International", city: "Delhi", country: "India", tier: "major" },
  { code: "BOM", name: "Chhatrapati Shivaji", city: "Mumbai", country: "India", tier: "major" },
  { code: "MAA", name: "Chennai International", city: "Chennai", country: "India", tier: "major" },
  { code: "CCU", name: "Netaji Subhas Chandra Bose", city: "Kolkata", country: "India", tier: "major" },
  { code: "BLR", name: "Kempegowda", city: "Bangalore", country: "India", tier: "major" },
  { code: "HYD", name: "Rajiv Gandhi", city: "Hyderabad", country: "India", tier: "regional" },
  { code: "COK", name: "Cochin International", city: "Kochi", country: "India", tier: "regional" },
  { code: "AMD", name: "Sardar Vallabhbhai Patel", city: "Ahmedabad", country: "India", tier: "regional" },
  { code: "GOI", name: "Goa International", city: "Goa", country: "India", tier: "regional" },
  // Pakistan
  { code: "KHI", name: "Jinnah International", city: "Karachi", country: "Pakistan", tier: "major" },
  { code: "ISB", name: "Islamabad International", city: "Islamabad", country: "Pakistan", tier: "major" },
  { code: "LHE", name: "Allama Iqbal International", city: "Lahore", country: "Pakistan", tier: "major" },
  { code: "PEW", name: "Bacha Khan International", city: "Peshawar", country: "Pakistan", tier: "regional" },
  { code: "MUX", name: "Multan International", city: "Multan", country: "Pakistan", tier: "regional" },
  { code: "SKT", name: "Sialkot International", city: "Sialkot", country: "Pakistan", tier: "regional" },
  { code: "LYP", name: "Faisalabad International", city: "Faisalabad", country: "Pakistan", tier: "regional" },
  { code: "UET", name: "Quetta International", city: "Quetta", country: "Pakistan", tier: "regional" },
  { code: "GWD", name: "Gwadar International", city: "Gwadar", country: "Pakistan", tier: "regional" },
  // Philippines
  { code: "MNL", name: "Ninoy Aquino International", city: "Manila", country: "Philippines", tier: "major" },
  { code: "CEB", name: "Mactan-Cebu International", city: "Cebu", country: "Philippines", tier: "major" },
  { code: "DVO", name: "Francisco Bangoy", city: "Davao", country: "Philippines", tier: "regional" },
  { code: "CRK", name: "Clark International", city: "Angeles", country: "Philippines", tier: "regional" },
  { code: "ILO", name: "Iloilo International", city: "Iloilo", country: "Philippines", tier: "regional" },
  { code: "KLO", name: "Kalibo International", city: "Kalibo", country: "Philippines", tier: "regional" },
  { code: "PPS", name: "Puerto Princesa", city: "Puerto Princesa", country: "Philippines", tier: "regional" },
  // Brazil
  { code: "GRU", name: "São Paulo/Guarulhos", city: "São Paulo", country: "Brazil", tier: "major" },
  { code: "GIG", name: "Galeão", city: "Rio de Janeiro", country: "Brazil", tier: "major" },
  { code: "SSA", name: "Deputado Luís Eduardo Magalhães", city: "Salvador", country: "Brazil", tier: "regional" },
  { code: "BSB", name: "Brasília", city: "Brasília", country: "Brazil", tier: "regional" },
  { code: "CNF", name: "Tancredo Neves", city: "Belo Horizonte", country: "Brazil", tier: "regional" },
  // Argentina
  { code: "EZE", name: "Ezeiza", city: "Buenos Aires", country: "Argentina", tier: "major" },
  { code: "AEP", name: "Aeroparque", city: "Buenos Aires", country: "Argentina", tier: "regional" },
  { code: "COR", name: "Córdoba", city: "Córdoba", country: "Argentina", tier: "regional" },
  { code: "MDZ", name: "El Plumerillo", city: "Mendoza", country: "Argentina", tier: "regional" },
  // Colombia
  { code: "BOG", name: "El Dorado", city: "Bogotá", country: "Colombia", tier: "major" },
  { code: "MDE", name: "José María Córdova", city: "Medellín", country: "Colombia", tier: "regional" },
  { code: "CTG", name: "Rafael Núñez", city: "Cartagena", country: "Colombia", tier: "regional" },
  { code: "CLO", name: "Alfonso Bonilla Aragón", city: "Cali", country: "Colombia", tier: "regional" },
  // Malaysia
  { code: "KUL", name: "Kuala Lumpur International", city: "Kuala Lumpur", country: "Malaysia", tier: "major" },
  { code: "PEN", name: "Penang International", city: "Penang", country: "Malaysia", tier: "regional" },
  { code: "BKI", name: "Kota Kinabalu", city: "Kota Kinabalu", country: "Malaysia", tier: "regional" },
  // Thailand
  { code: "BKK", name: "Suvarnabhumi", city: "Bangkok", country: "Thailand", tier: "major" },
  { code: "DMK", name: "Don Mueang", city: "Bangkok", country: "Thailand", tier: "regional" },
  { code: "CNX", name: "Chiang Mai", city: "Chiang Mai", country: "Thailand", tier: "regional" },
  { code: "HKT", name: "Phuket", city: "Phuket", country: "Thailand", tier: "regional" },
  // Vietnam
  { code: "SGN", name: "Tan Son Nhat", city: "Ho Chi Minh City", country: "Vietnam", tier: "major" },
  { code: "HAN", name: "Noi Bai", city: "Hanoi", country: "Vietnam", tier: "major" },
  { code: "DAD", name: "Da Nang", city: "Da Nang", country: "Vietnam", tier: "regional" },
  // Egypt
  { code: "CAI", name: "Cairo International", city: "Cairo", country: "Egypt", tier: "major" },
  { code: "HRG", name: "Hurghada", city: "Hurghada", country: "Egypt", tier: "regional" },
  { code: "SSH", name: "Sharm El Sheikh", city: "Sharm El Sheikh", country: "Egypt", tier: "regional" },
  // Portugal
  { code: "LIS", name: "Lisbon Portela", city: "Lisbon", country: "Portugal", tier: "major" },
  { code: "OPO", name: "Francisco Sá Carneiro", city: "Porto", country: "Portugal", tier: "regional" },
  { code: "FAO", name: "Faro", city: "Faro", country: "Portugal", tier: "regional" },
  // Spain
  { code: "MAD", name: "Adolfo Suárez Madrid-Barajas", city: "Madrid", country: "Spain", tier: "major" },
  { code: "BCN", name: "El Prat", city: "Barcelona", country: "Spain", tier: "major" },
  { code: "PMI", name: "Palma de Mallorca", city: "Palma", country: "Spain", tier: "regional" },
  { code: "AGP", name: "Málaga-Costa del Sol", city: "Málaga", country: "Spain", tier: "regional" },
  { code: "VLC", name: "Valencia", city: "Valencia", country: "Spain", tier: "regional" },
  // Italy
  { code: "FCO", name: "Leonardo da Vinci–Fiumicino", city: "Rome", country: "Italy", tier: "major" },
  { code: "MXP", name: "Malpensa", city: "Milan", country: "Italy", tier: "major" },
  { code: "NAP", name: "Naples", city: "Naples", country: "Italy", tier: "regional" },
  { code: "VCE", name: "Marco Polo", city: "Venice", country: "Italy", tier: "regional" },
  { code: "BLQ", name: "Guglielmo Marconi", city: "Bologna", country: "Italy", tier: "regional" },
  // Turkey
  { code: "IST", name: "Istanbul", city: "Istanbul", country: "Turkey", tier: "major" },
  { code: "SAW", name: "Sabiha Gökçen", city: "Istanbul", country: "Turkey", tier: "regional" },
  { code: "ESB", name: "Esenboğa", city: "Ankara", country: "Turkey", tier: "regional" },
  { code: "AYT", name: "Antalya", city: "Antalya", country: "Turkey", tier: "regional" },
  { code: "ADB", name: "İzmir Adnan Menderes", city: "İzmir", country: "Turkey", tier: "regional" },
  // Bangladesh
  { code: "DAC", name: "Hazrat Shahjalal", city: "Dhaka", country: "Bangladesh", tier: "major" },
  { code: "CGP", name: "Shah Amanat", city: "Chittagong", country: "Bangladesh", tier: "regional" },
  { code: "ZYL", name: "Osmani", city: "Sylhet", country: "Bangladesh", tier: "regional" },
  // Sri Lanka
  { code: "CMB", name: "Bandaranaike International", city: "Colombo", country: "Sri Lanka", tier: "major" },
  { code: "HRI", name: "Mattala Rajapaksa", city: "Hambantota", country: "Sri Lanka", tier: "regional" },
  // Ethiopia
  { code: "ADD", name: "Bole International", city: "Addis Ababa", country: "Ethiopia", tier: "major" },
  // Nigeria
  { code: "LOS", name: "Murtala Muhammed International", city: "Lagos", country: "Nigeria", tier: "major" },
  { code: "ABV", name: "Nnamdi Azikiwe", city: "Abuja", country: "Nigeria", tier: "regional" },
  { code: "PHC", name: "Port Harcourt", city: "Port Harcourt", country: "Nigeria", tier: "regional" },
  { code: "KAN", name: "Mallam Aminu Kano", city: "Kano", country: "Nigeria", tier: "regional" },
  // Dominican Republic
  { code: "SDQ", name: "Las Américas", city: "Santo Domingo", country: "Dominican Republic", tier: "major" },
  { code: "PUJ", name: "Punta Cana", city: "Punta Cana", country: "Dominican Republic", tier: "major" },
  { code: "STI", name: "Cibao", city: "Santiago", country: "Dominican Republic", tier: "regional" },
  // Panama
  { code: "PTY", name: "Tocumen International", city: "Panama City", country: "Panama", tier: "major" },
  // Costa Rica
  { code: "SJO", name: "Juan Santamaría", city: "San José", country: "Costa Rica", tier: "major" },
  { code: "LIR", name: "Daniel Oduber Quirós", city: "Liberia", country: "Costa Rica", tier: "regional" },
  // Nepal
  { code: "KTM", name: "Tribhuvan", city: "Kathmandu", country: "Nepal", tier: "major" },
  // Indonesia
  { code: "CGK", name: "Soekarno-Hatta", city: "Jakarta", country: "Indonesia", tier: "major" },
  { code: "DPS", name: "Ngurah Rai", city: "Bali", country: "Indonesia", tier: "major" },
  { code: "SUB", name: "Juanda", city: "Surabaya", country: "Indonesia", tier: "regional" },
  { code: "MDC", name: "Sam Ratulangi", city: "Manado", country: "Indonesia", tier: "regional" },
  // Australia
  { code: "SYD", name: "Kingsford Smith", city: "Sydney", country: "Australia", tier: "major" },
  { code: "MEL", name: "Melbourne", city: "Melbourne", country: "Australia", tier: "major" },
  { code: "BNE", name: "Brisbane", city: "Brisbane", country: "Australia", tier: "regional" },
  { code: "PER", name: "Perth", city: "Perth", country: "Australia", tier: "regional" },
  // New Zealand
  { code: "AKL", name: "Auckland", city: "Auckland", country: "New Zealand", tier: "major" },
  { code: "WLG", name: "Wellington", city: "Wellington", country: "New Zealand", tier: "regional" },
  { code: "CHC", name: "Christchurch", city: "Christchurch", country: "New Zealand", tier: "regional" },
  // Chile
  { code: "SCL", name: "Arturo Merino Benítez", city: "Santiago", country: "Chile", tier: "major" },
  // Ecuador
  { code: "UIO", name: "Mariscal Sucre", city: "Quito", country: "Ecuador", tier: "major" },
  { code: "GYE", name: "José Joaquín de Olmedo", city: "Guayaquil", country: "Ecuador", tier: "regional" },
  // Peru
  { code: "LIM", name: "Jorge Chávez", city: "Lima", country: "Peru", tier: "major" },
  { code: "CUZ", name: "Alejandro Velasco Astete", city: "Cusco", country: "Peru", tier: "regional" },
  // Morocco
  { code: "CMN", name: "Mohammed V", city: "Casablanca", country: "Morocco", tier: "major" },
  { code: "RAK", name: "Menara", city: "Marrakech", country: "Morocco", tier: "regional" },
  { code: "TNG", name: "Tangier Ibn Battouta", city: "Tangier", country: "Morocco", tier: "regional" },
  // Kenya
  { code: "NBO", name: "Jomo Kenyatta", city: "Nairobi", country: "Kenya", tier: "major" },
  { code: "MBA", name: "Moi International", city: "Mombasa", country: "Kenya", tier: "regional" },
  // Ghana
  { code: "ACC", name: "Kotoka International", city: "Accra", country: "Ghana", tier: "major" },
  // Jamaica
  { code: "MBJ", name: "Sangster", city: "Montego Bay", country: "Jamaica", tier: "major" },
  { code: "KIN", name: "Norman Manley", city: "Kingston", country: "Jamaica", tier: "regional" },
  // Poland
  { code: "WAW", name: "Chopin", city: "Warsaw", country: "Poland", tier: "major" },
  { code: "KRK", name: "John Paul II", city: "Kraków", country: "Poland", tier: "regional" },
  { code: "GDN", name: "Gdańsk Lech Wałęsa", city: "Gdańsk", country: "Poland", tier: "regional" },
  // Greece
  { code: "ATH", name: "Eleftherios Venizelos", city: "Athens", country: "Greece", tier: "major" },
  { code: "SKG", name: "Thessaloniki", city: "Thessaloniki", country: "Greece", tier: "regional" },
  { code: "HER", name: "Heraklion", city: "Crete", country: "Greece", tier: "regional" },
  // South Africa
  { code: "JNB", name: "O.R. Tambo", city: "Johannesburg", country: "South Africa", tier: "major" },
  { code: "CPT", name: "Cape Town", city: "Cape Town", country: "South Africa", tier: "major" },
  { code: "DUR", name: "King Shaka", city: "Durban", country: "South Africa", tier: "regional" },
  // Israel
  { code: "TLV", name: "Ben Gurion", city: "Tel Aviv", country: "Israel", tier: "major" },
  // Jordan
  { code: "AMM", name: "Queen Alia", city: "Amman", country: "Jordan", tier: "major" },
  { code: "AQJ", name: "King Hussein", city: "Aqaba", country: "Jordan", tier: "regional" },
  // Cambodia
  { code: "PNH", name: "Phnom Penh", city: "Phnom Penh", country: "Cambodia", tier: "major" },
  { code: "REP", name: "Siem Reap", city: "Siem Reap", country: "Cambodia", tier: "regional" },
  // Cuba
  { code: "HAV", name: "José Martí", city: "Havana", country: "Cuba", tier: "major" },
  { code: "VRA", name: "Juan Gualberto Gómez", city: "Varadero", country: "Cuba", tier: "regional" },
  // Ireland
  { code: "DUB", name: "Dublin", city: "Dublin", country: "Ireland", tier: "major" },
  { code: "SNN", name: "Shannon", city: "Shannon", country: "Ireland", tier: "regional" },
  { code: "ORK", name: "Cork", city: "Cork", country: "Ireland", tier: "regional" },
  // Belgium
  { code: "BRU", name: "Brussels", city: "Brussels", country: "Belgium", tier: "major" },
  // Switzerland
  { code: "ZRH", name: "Zurich", city: "Zurich", country: "Switzerland", tier: "major" },
  { code: "GVA", name: "Geneva", city: "Geneva", country: "Switzerland", tier: "regional" },
  // Austria
  { code: "VIE", name: "Vienna", city: "Vienna", country: "Austria", tier: "major" },
  // Qatar
  { code: "DOH", name: "Hamad International", city: "Doha", country: "Qatar", tier: "major" },
  // Bahrain
  { code: "BAH", name: "Bahrain", city: "Manama", country: "Bahrain", tier: "major" },
  // Oman
  { code: "MCT", name: "Muscat", city: "Muscat", country: "Oman", tier: "major" },
  { code: "SLL", name: "Salalah", city: "Salalah", country: "Oman", tier: "regional" },
  // Uruguay
  { code: "MVD", name: "Carrasco", city: "Montevideo", country: "Uruguay", tier: "major" },
  // Czech Republic
  { code: "PRG", name: "Václav Havel", city: "Prague", country: "Czech Republic", tier: "major" },
  // Hungary
  { code: "BUD", name: "Ferenc Liszt", city: "Budapest", country: "Hungary", tier: "major" },
  // Romania
  { code: "OTP", name: "Henri Coandă", city: "Bucharest", country: "Romania", tier: "major" },
  // Croatia
  { code: "ZAG", name: "Franjo Tuđman", city: "Zagreb", country: "Croatia", tier: "major" },
  { code: "DBV", name: "Dubrovnik", city: "Dubrovnik", country: "Croatia", tier: "regional" },
  { code: "SPU", name: "Split", city: "Split", country: "Croatia", tier: "regional" },
  // El Salvador
  { code: "SAL", name: "Monseñor Óscar Romero", city: "San Salvador", country: "El Salvador", tier: "major" },
  // Guatemala
  { code: "GUA", name: "La Aurora", city: "Guatemala City", country: "Guatemala", tier: "major" },
  // Honduras
  { code: "SAP", name: "Ramón Villeda Morales", city: "San Pedro Sula", country: "Honduras", tier: "major" },
  { code: "TGU", name: "Toncontín", city: "Tegucigalpa", country: "Honduras", tier: "regional" },
  // Nicaragua
  { code: "MGA", name: "Augusto C. Sandino", city: "Managua", country: "Nicaragua", tier: "major" },
];

export const ADVISORY_LABELS: Record<AdvisoryLevel, string> = {
  1: "Exercise Normal Precautions",
  2: "Exercise Increased Caution",
  3: "Reconsider Travel",
  4: "Do Not Travel",
};
