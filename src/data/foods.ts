// Offline food reference. Values per 100 g (or 100 ml for drinks), rounded approximations from
// TKPI (Tabel Komposisi Pangan Indonesia) and USDA FoodData Central. Restaurant/street dishes vary
// a lot with oil, santan and portion size — treat every number as an estimate the user can edit.

export type FoodCategory =
  | "karbo"
  | "lauk_hewani"
  | "lauk_nabati"
  | "sayur"
  | "buah"
  | "makanan_jadi"
  | "jajanan"
  | "susu"
  | "minuman"
  | "tambahan";

export const FOOD_CATEGORY_LABEL: Record<FoodCategory, string> = {
  karbo: "Nasi, mie & roti",
  lauk_hewani: "Lauk hewani",
  lauk_nabati: "Tahu, tempe & kacang",
  sayur: "Sayur",
  buah: "Buah",
  makanan_jadi: "Hidangan",
  jajanan: "Jajanan & gorengan",
  susu: "Susu & protein",
  minuman: "Minuman",
  tambahan: "Bumbu & tambahan",
};

export type Serving = { label: string; grams: number };

export type FoodItem = {
  id: string;
  name: string;
  category: FoodCategory;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** "ml" for drinks; amounts are then entered in ml and treated as grams. */
  unit: "g" | "ml";
  servings: Serving[];
  aliases: string[];
};

type Macros = [kcal: number, protein: number, carbs: number, fat: number];

function food(
  id: string,
  name: string,
  category: FoodCategory,
  [kcal, protein, carbs, fat]: Macros,
  servings: [string, number][],
  aliases: string[] = [],
  unit: "g" | "ml" = "g",
): FoodItem {
  return { id, name, category, kcal, protein, carbs, fat, unit, servings: servings.map(([label, grams]) => ({ label, grams })), aliases };
}

const drink = (id: string, name: string, m: Macros, servings: [string, number][], aliases: string[] = [], category: FoodCategory = "minuman") =>
  food(id, name, category, m, servings, aliases, "ml");

export const FOODS: FoodItem[] = [
  // ---- Nasi, mie, roti & umbi ----
  food("nasi-putih", "Nasi putih", "karbo", [130, 2.7, 28.2, 0.3], [["1 centong", 100], ["1 piring", 200], ["½ porsi", 75]], ["rice", "nasi"]),
  food("nasi-merah", "Nasi merah", "karbo", [110, 2.6, 23, 0.9], [["1 centong", 100], ["1 piring", 200]], ["brown rice"]),
  food("nasi-uduk", "Nasi uduk", "karbo", [170, 3, 28, 5], [["1 porsi nasi", 150]], ["nasi gurih"]),
  food("nasi-kuning", "Nasi kuning", "karbo", [160, 3, 28, 4], [["1 porsi nasi", 150]]),
  food("nasi-goreng", "Nasi goreng (dengan telur)", "makanan_jadi", [180, 5, 25, 7], [["1 piring", 300], ["½ piring", 150]], ["nasgor", "fried rice"]),
  food("lontong", "Lontong / ketupat", "karbo", [110, 2, 24, 0.2], [["1 potong", 50], ["1 buah ketupat", 150]], ["ketupat"]),
  food("bubur-ayam", "Bubur ayam (lengkap)", "makanan_jadi", [105, 4.5, 15, 3], [["1 mangkuk", 350]], ["bubur"]),
  food("kentang-rebus", "Kentang rebus", "karbo", [87, 1.9, 20, 0.1], [["1 buah sedang", 150]], ["potato"]),
  food("ubi-rebus", "Ubi jalar rebus", "karbo", [86, 1.6, 20, 0.1], [["1 buah sedang", 130]], ["sweet potato", "ubi"]),
  food("singkong-rebus", "Singkong rebus", "karbo", [160, 1.4, 38, 0.3], [["1 potong", 100]], ["ketela"]),
  food("jagung-rebus", "Jagung rebus", "karbo", [96, 3.4, 21, 1.5], [["1 tongkol", 100]], ["corn"]),
  food("indomie-goreng", "Mie instan goreng (kering)", "karbo", [447, 9.4, 63.5, 16.5], [["1 bungkus", 85]], ["indomie goreng", "mie goreng instan"]),
  food("indomie-kuah", "Mie instan kuah (kering)", "karbo", [427, 9.3, 60, 16], [["1 bungkus", 75]], ["indomie kuah", "mie rebus", "mi instan"]),
  food("mie-goreng", "Mie goreng (warung)", "makanan_jadi", [180, 5, 24, 7], [["1 piring", 300]], ["mi goreng"]),
  food("mie-ayam", "Mie ayam", "makanan_jadi", [140, 6, 20, 4], [["1 mangkuk", 300]], ["mi ayam", "bakmi ayam"]),
  food("bihun-goreng", "Bihun goreng", "makanan_jadi", [160, 3, 28, 4.5], [["1 piring", 250]]),
  food("kwetiau-goreng", "Kwetiau goreng", "makanan_jadi", [170, 5, 25, 6], [["1 piring", 300]], ["kwetiaw"]),
  food("roti-tawar", "Roti tawar putih", "karbo", [265, 9, 49, 3.2], [["1 lembar", 25]], ["bread"]),
  food("roti-gandum", "Roti gandum", "karbo", [247, 13, 41, 3.4], [["1 lembar", 30]], ["whole wheat"]),
  food("oatmeal", "Oat (kering)", "karbo", [379, 13, 68, 6.5], [["3 sdm", 30], ["½ cup", 40]], ["oatmeal", "havermut"]),
  food("cornflakes", "Sereal cornflakes", "karbo", [357, 7.5, 84, 0.4], [["1 mangkuk", 30]], ["sereal", "cereal"]),
  food("granola", "Granola", "karbo", [470, 10, 64, 20], [["¼ cup", 30]]),
  food("pasta", "Pasta / spaghetti (matang)", "karbo", [158, 5.8, 31, 0.9], [["1 piring", 200]], ["spageti", "makaroni"]),
  food("kentang-goreng", "Kentang goreng", "jajanan", [312, 3.4, 41, 15], [["kecil", 80], ["sedang", 117], ["besar", 150]], ["french fries"]),

  // ---- Lauk hewani ----
  food("ayam-goreng-dada", "Ayam goreng dada", "lauk_hewani", [250, 28, 4, 13], [["1 potong (tanpa tulang)", 90]], ["ayam goreng"]),
  food("ayam-goreng-paha", "Ayam goreng paha", "lauk_hewani", [275, 22, 6, 18], [["1 potong (tanpa tulang)", 80]], ["ayam goreng"]),
  food("ayam-goreng-tepung", "Ayam goreng tepung (krispi)", "lauk_hewani", [280, 18, 12, 18], [["1 potong", 130]], ["fried chicken", "kfc", "ayam krispi"]),
  food("ayam-geprek", "Ayam geprek", "lauk_hewani", [300, 20, 12, 19], [["1 porsi ayam", 150]]),
  food("ayam-bakar", "Ayam bakar", "lauk_hewani", [190, 27, 4, 7], [["1 potong (tanpa tulang)", 90]]),
  food("dada-ayam-rebus", "Dada ayam tanpa kulit (rebus/panggang)", "lauk_hewani", [165, 31, 0, 3.6], [["1 potong", 100], ["1 fillet", 150]], ["chicken breast", "dada ayam"]),
  food("opor-ayam", "Opor ayam", "lauk_hewani", [165, 14, 3, 11], [["1 potong + kuah", 150]]),
  food("gulai-ayam", "Gulai ayam", "lauk_hewani", [160, 14, 3, 10], [["1 potong + kuah", 150]]),
  food("ayam-pop", "Ayam pop", "lauk_hewani", [180, 25, 1, 8], [["1 potong", 100]]),
  food("ati-ampela", "Ati ampela", "lauk_hewani", [167, 24, 1, 6.5], [["1 tusuk / pasang", 40]], ["hati ayam"]),
  food("telur-rebus", "Telur ayam rebus", "lauk_hewani", [155, 12.6, 1.1, 10.6], [["1 butir", 55]], ["telur", "egg"]),
  food("telur-ceplok", "Telur ceplok / mata sapi", "lauk_hewani", [196, 13.6, 0.8, 15], [["1 butir", 55]], ["telur goreng"]),
  food("telur-dadar", "Telur dadar", "lauk_hewani", [190, 13, 1, 15], [["1 butir", 60]], ["omelet", "telor dadar"]),
  food("putih-telur", "Putih telur", "lauk_hewani", [52, 11, 0.7, 0.2], [["1 butir", 33]], ["egg white"]),
  food("rendang", "Rendang daging", "lauk_hewani", [195, 20, 6, 10], [["1 potong", 70]]),
  food("daging-sapi", "Daging sapi (masak)", "lauk_hewani", [250, 26, 0, 15], [["1 potong", 60]], ["beef", "steak"]),
  food("semur-daging", "Semur daging", "lauk_hewani", [175, 18, 7, 8], [["1 potong + kuah", 100]]),
  food("empal", "Empal daging", "lauk_hewani", [250, 25, 8, 13], [["1 potong", 50]]),
  food("bakso-butir", "Bakso sapi (butir)", "lauk_hewani", [190, 11, 14, 10], [["1 butir sedang", 15], ["1 butir besar", 40]], ["pentol"]),
  food("sate-ayam", "Sate ayam + bumbu kacang", "lauk_hewani", [230, 20, 8, 13], [["1 tusuk", 20], ["10 tusuk", 200]], ["satay"]),
  food("sate-kambing", "Sate kambing", "lauk_hewani", [230, 22, 4, 14], [["1 tusuk", 20], ["10 tusuk", 200]]),
  food("lele-goreng", "Lele goreng", "lauk_hewani", [240, 18, 6, 16], [["1 ekor sedang", 100]], ["pecel lele"]),
  food("ikan-bakar", "Ikan bakar (nila/kembung)", "lauk_hewani", [160, 26, 2, 5.5], [["1 ekor sedang", 120]], ["ikan nila", "kembung"]),
  food("ikan-goreng", "Ikan goreng", "lauk_hewani", [220, 22, 4, 13], [["1 potong", 80]], ["fish"]),
  food("tongkol-balado", "Tongkol balado", "lauk_hewani", [180, 22, 4, 8], [["1 potong", 70]], ["tuna"]),
  food("tuna-kaleng", "Tuna kaleng dalam air (tiris)", "lauk_hewani", [116, 26, 0, 1], [["1 kaleng", 120]]),
  food("salmon", "Salmon (masak)", "lauk_hewani", [208, 20, 0, 13], [["1 fillet", 120]]),
  food("udang", "Udang rebus", "lauk_hewani", [99, 24, 0.2, 0.3], [["5 ekor sedang", 60]], ["shrimp"]),
  food("cumi-goreng", "Cumi goreng tepung", "lauk_hewani", [175, 18, 8, 7.5], [["1 porsi", 100]], ["calamari"]),
  food("sosis", "Sosis sapi/ayam", "lauk_hewani", [280, 11, 5, 24], [["1 buah", 40]], ["sausage"]),
  food("nugget", "Nugget ayam", "lauk_hewani", [296, 15, 16, 19], [["1 potong", 20]]),
  food("kornet", "Kornet sapi", "lauk_hewani", [250, 25, 0, 15], [["2 sdm", 40]], ["corned beef"]),

  // ---- Tahu, tempe & kacang ----
  food("tahu-goreng", "Tahu goreng", "lauk_nabati", [115, 9.7, 2.5, 8.5], [["1 potong", 40]], ["tofu"]),
  food("tahu-kukus", "Tahu putih (kukus/rebus)", "lauk_nabati", [76, 8, 1.9, 4.8], [["1 potong", 50]]),
  food("tempe-goreng", "Tempe goreng", "lauk_nabati", [335, 20, 8, 25], [["1 potong", 30]], ["tempe"]),
  food("tempe-kukus", "Tempe (kukus/rebus)", "lauk_nabati", [193, 19, 9, 11], [["1 potong", 30]]),
  food("tempe-bacem", "Tempe bacem", "lauk_nabati", [220, 14, 18, 10], [["1 potong", 40]]),
  food("tahu-bacem", "Tahu bacem", "lauk_nabati", [150, 10, 10, 8], [["1 potong", 50]]),
  food("tempe-mendoan", "Tempe mendoan", "lauk_nabati", [290, 12, 25, 16], [["1 potong", 50]], ["mendoan"]),
  food("tahu-isi", "Tahu isi goreng", "jajanan", [250, 7, 25, 14], [["1 buah", 60]], ["tahu isi", "gorengan"]),
  food("perkedel", "Perkedel kentang", "lauk_nabati", [180, 4, 18, 10], [["1 buah", 50]], ["bergedel"]),
  food("kacang-tanah", "Kacang tanah goreng", "lauk_nabati", [580, 26, 18, 49], [["1 sdm", 10], ["1 genggam", 30]], ["peanut"]),
  food("edamame", "Edamame rebus", "lauk_nabati", [121, 12, 9, 5], [["1 mangkuk kecil", 100]]),
  food("almond", "Almond", "lauk_nabati", [579, 21, 22, 50], [["1 genggam (±23 butir)", 28]], ["kacang almond"]),

  // ---- Sayur ----
  food("sayur-asem", "Sayur asem", "sayur", [30, 1, 6, 0.3], [["1 mangkuk", 200]]),
  food("sayur-sop", "Sayur sop", "sayur", [35, 1.5, 6, 0.6], [["1 mangkuk", 200]], ["sop sayur", "sup"]),
  food("sayur-lodeh", "Sayur lodeh", "sayur", [75, 2, 6, 5], [["1 mangkuk", 200]]),
  food("sayur-bayam", "Sayur bayam bening", "sayur", [20, 1.5, 3, 0.2], [["1 mangkuk", 200]], ["bayam"]),
  food("capcay", "Capcay", "sayur", [70, 3, 6, 4], [["1 porsi", 200]], ["cap cay"]),
  food("tumis-kangkung", "Tumis kangkung", "sayur", [80, 3, 5, 6], [["1 porsi", 100]], ["kangkung"]),
  food("tumis-buncis", "Tumis buncis / sayuran", "sayur", [70, 2, 7, 4], [["1 porsi", 100]], ["tumisan"]),
  food("terong-balado", "Terong balado", "sayur", [110, 1.5, 8, 8], [["1 porsi", 100]], ["terong"]),
  food("gado-gado", "Gado-gado", "makanan_jadi", [135, 6, 11, 8], [["1 porsi (tanpa lontong)", 300]]),
  food("pecel", "Pecel sayur", "makanan_jadi", [120, 5, 12, 6], [["1 porsi", 250]], ["sayur pecel"]),
  food("karedok", "Karedok", "sayur", [110, 4, 10, 6], [["1 porsi", 200]]),
  food("urap", "Urap sayur", "sayur", [110, 3, 9, 7], [["1 porsi", 100]]),
  food("salad", "Salad sayur (tanpa dressing)", "sayur", [20, 1.2, 3.5, 0.2], [["1 mangkuk", 100]], ["selada", "lalapan"]),
  food("brokoli", "Brokoli rebus", "sayur", [35, 2.4, 7, 0.4], [["1 mangkuk", 90]], ["broccoli"]),
  food("wortel", "Wortel rebus", "sayur", [35, 0.8, 8, 0.2], [["1 buah", 60]], ["carrot"]),
  food("timun", "Timun", "sayur", [15, 0.7, 3.6, 0.1], [["1 buah", 150]], ["mentimun", "cucumber"]),
  food("sambal", "Sambal (cabai + minyak)", "tambahan", [120, 2, 10, 8], [["1 sdm", 15]], ["sambel"]),

  // ---- Buah ----
  food("pisang", "Pisang", "buah", [89, 1.1, 23, 0.3], [["1 buah sedang", 100], ["1 buah kecil", 70]], ["banana"]),
  food("apel", "Apel", "buah", [52, 0.3, 14, 0.2], [["1 buah", 150]], ["apple"]),
  food("jeruk", "Jeruk", "buah", [47, 0.9, 12, 0.1], [["1 buah", 130]], ["orange"]),
  food("pepaya", "Pepaya", "buah", [43, 0.5, 11, 0.3], [["1 potong", 150]], ["papaya"]),
  food("semangka", "Semangka", "buah", [30, 0.6, 7.6, 0.2], [["1 potong", 200]], ["watermelon"]),
  food("mangga", "Mangga", "buah", [60, 0.8, 15, 0.4], [["1 buah", 200]], ["mango"]),
  food("alpukat", "Alpukat", "buah", [160, 2, 8.5, 14.7], [["½ buah", 75], ["1 buah", 150]], ["avocado", "avokad"]),
  food("melon", "Melon", "buah", [34, 0.8, 8, 0.2], [["1 potong", 150]]),
  food("nanas", "Nanas", "buah", [50, 0.5, 13, 0.1], [["1 potong", 100]], ["pineapple"]),
  food("anggur", "Anggur", "buah", [69, 0.7, 18, 0.2], [["10 butir", 50]], ["grape"]),
  food("salak", "Salak", "buah", [77, 0.4, 20, 0], [["1 buah", 30]]),
  food("rambutan", "Rambutan", "buah", [82, 0.7, 21, 0.2], [["5 buah", 75]]),
  food("durian", "Durian", "buah", [147, 1.5, 27, 5.3], [["1 porsi", 100]]),
  food("jambu-biji", "Jambu biji", "buah", [68, 2.6, 14, 1], [["1 buah", 150]], ["guava"]),
  food("buah-naga", "Buah naga", "buah", [60, 1.2, 13, 0.4], [["½ buah", 150]], ["dragon fruit"]),
  food("kurma", "Kurma", "buah", [277, 1.8, 75, 0.2], [["1 butir", 8], ["1 butir medjool", 24]], ["dates"]),
  food("stroberi", "Stroberi", "buah", [32, 0.7, 7.7, 0.3], [["5 buah", 75]], ["strawberry"]),

  // ---- Hidangan ----
  food("soto-ayam", "Soto ayam (tanpa nasi)", "makanan_jadi", [60, 5, 3, 3], [["1 mangkuk", 350]], ["soto"]),
  food("rawon", "Rawon (tanpa nasi)", "makanan_jadi", [85, 7, 3, 5], [["1 mangkuk", 300]]),
  food("bakso-kuah", "Bakso kuah (lengkap dengan mie)", "makanan_jadi", [85, 5, 9, 3], [["1 mangkuk", 400]], ["bakso"]),
  food("nasi-padang", "Nasi Padang (nasi + rendang + sayur)", "makanan_jadi", [165, 6, 20, 7], [["1 bungkus", 450]], ["padang"]),
  food("ketoprak", "Ketoprak", "makanan_jadi", [145, 5, 18, 6], [["1 porsi", 350]]),
  food("gudeg", "Gudeg (nangka)", "makanan_jadi", [135, 2.5, 18, 6], [["1 porsi", 150]]),
  food("seblak", "Seblak", "makanan_jadi", [130, 4, 18, 5], [["1 mangkuk", 300]]),
  food("siomay", "Siomay + bumbu kacang", "makanan_jadi", [160, 8, 18, 6], [["1 porsi", 250]], ["somay"]),
  food("batagor", "Batagor", "makanan_jadi", [230, 8, 22, 12], [["1 porsi", 200]]),
  food("pempek", "Pempek + cuko", "makanan_jadi", [200, 9, 30, 5], [["1 buah kecil", 50], ["1 kapal selam", 150]], ["empek-empek"]),
  food("fuyunghai", "Fu yung hai", "makanan_jadi", [180, 9, 6, 13], [["1 porsi", 150]], ["puyunghai"]),
  food("burger", "Burger keju", "makanan_jadi", [260, 13, 27, 11], [["1 buah", 120], ["1 buah besar", 220]], ["cheeseburger", "mcd"]),
  food("pizza", "Pizza", "makanan_jadi", [266, 11, 33, 10], [["1 slice", 100]]),
  food("spaghetti-bolognese", "Spaghetti bolognese", "makanan_jadi", [150, 7, 18, 5], [["1 piring", 300]]),
  food("ramen", "Ramen", "makanan_jadi", [100, 5, 12, 4], [["1 mangkuk", 500]]),
  food("sushi", "Sushi roll", "makanan_jadi", [150, 5, 28, 1.5], [["1 potong", 30], ["1 porsi (8 pcs)", 240]]),
  food("kebab", "Kebab", "makanan_jadi", [220, 11, 22, 10], [["1 buah", 200]]),
  food("dimsum", "Dimsum siomay ayam", "makanan_jadi", [200, 10, 15, 11], [["1 buah", 25], ["1 porsi (4 pcs)", 100]], ["dim sum", "shumai"]),

  // ---- Jajanan & gorengan ----
  food("pisang-goreng", "Pisang goreng", "jajanan", [230, 2, 35, 10], [["1 buah", 70]], ["gorengan"]),
  food("bakwan", "Bakwan / bala-bala", "jajanan", [280, 5, 30, 16], [["1 buah", 50]], ["bakwan sayur", "gorengan"]),
  food("risoles", "Risoles", "jajanan", [250, 6, 28, 13], [["1 buah", 60]], ["risol"]),
  food("lemper", "Lemper ayam", "jajanan", [200, 6, 33, 5], [["1 buah", 60]]),
  food("martabak-manis", "Martabak manis cokelat kacang", "jajanan", [350, 7, 45, 16], [["1 potong", 75]], ["terang bulan"]),
  food("martabak-telur", "Martabak telur", "jajanan", [250, 10, 18, 15], [["1 potong", 60]]),
  food("cilok", "Cilok", "jajanan", [180, 3, 35, 2], [["1 porsi", 100]]),
  food("kerupuk", "Kerupuk", "jajanan", [480, 5, 70, 20], [["1 keping", 10]], ["krupuk"]),
  food("keripik-kentang", "Keripik kentang", "jajanan", [536, 7, 53, 35], [["1 genggam", 20], ["1 bungkus", 68]], ["chips", "chitato"]),
  food("donat", "Donat", "jajanan", [420, 5, 50, 22], [["1 buah", 55]], ["donut"]),
  food("onde-onde", "Onde-onde", "jajanan", [330, 6, 45, 14], [["1 buah", 50]]),
  food("bakpao", "Bakpao", "jajanan", [250, 7, 40, 6], [["1 buah", 80]]),
  food("roti-manis", "Roti manis isi", "jajanan", [330, 7, 50, 11], [["1 buah", 70]], ["roti cokelat", "roti isi"]),
  food("roti-bakar", "Roti bakar cokelat keju", "jajanan", [300, 8, 38, 13], [["1 porsi", 150]]),
  food("cokelat", "Cokelat batang", "jajanan", [535, 7.6, 59, 30], [["1 bar kecil", 30]], ["chocolate"]),
  food("biskuit", "Biskuit", "jajanan", [440, 7, 70, 15], [["3 keping", 20]], ["biscuit", "cookies"]),
  food("es-krim", "Es krim", "jajanan", [207, 3.5, 24, 11], [["1 stik / cone", 60], ["1 cup", 100]], ["ice cream"]),
  food("bubur-kacang-hijau", "Bubur kacang hijau", "jajanan", [110, 3.5, 17, 3], [["1 mangkuk", 250]], ["burjo"]),

  // ---- Susu & protein ----
  drink("susu-full-cream", "Susu UHT full cream", [61, 3.2, 4.8, 3.3], [["1 kotak", 200], ["1 gelas", 250]], ["susu", "milk"], "susu"),
  drink("susu-low-fat", "Susu rendah lemak", [42, 3.4, 5, 1], [["1 gelas", 250]], ["susu skim", "low fat"], "susu"),
  drink("susu-cokelat", "Susu UHT cokelat", [85, 3, 12, 3], [["1 kotak", 200]], ["susu coklat"], "susu"),
  drink("susu-kedelai", "Susu kedelai (manis)", [54, 3.3, 6, 1.8], [["1 gelas", 250]], ["soy milk", "sari kedelai"], "susu"),
  food("skm", "Susu kental manis", "susu", [321, 7.9, 54, 8.7], [["1 sdm", 20]], ["kental manis"]),
  food("yogurt", "Yogurt plain", "susu", [61, 3.5, 4.7, 3.3], [["1 cup", 150]], ["yoghurt"]),
  food("greek-yogurt", "Greek yogurt plain", "susu", [97, 9, 3.6, 5], [["1 cup", 150]]),
  food("keju", "Keju cheddar", "susu", [400, 25, 1.3, 33], [["1 lembar", 20]], ["cheese"]),
  food("whey", "Whey protein (bubuk)", "susu", [400, 80, 8, 6], [["1 scoop", 30]], ["protein shake", "whey"]),

  // ---- Minuman ----
  drink("es-teh-manis", "Es teh manis", [40, 0, 10, 0], [["1 gelas", 250]], ["teh manis", "es teh"]),
  drink("teh-tawar", "Teh tawar", [1, 0, 0.3, 0], [["1 gelas", 250]], ["teh"]),
  drink("kopi-hitam", "Kopi hitam tanpa gula", [2, 0.1, 0, 0], [["1 cangkir", 200]], ["americano", "kopi"]),
  drink("kopi-susu-aren", "Kopi susu gula aren", [80, 1.6, 12, 3], [["1 cup", 250]], ["es kopi susu", "kopi kekinian"]),
  food("kopi-sachet", "Kopi sachet 3in1 (bubuk)", "minuman", [450, 4, 70, 16], [["1 sachet", 20]], ["kopi instan"]),
  drink("jus-jeruk", "Jus jeruk", [45, 0.7, 10, 0.2], [["1 gelas", 250]], ["es jeruk", "orange juice"]),
  drink("jus-alpukat", "Jus alpukat (dengan SKM)", [120, 1.5, 15, 6], [["1 gelas", 300]]),
  drink("jus-mangga", "Jus mangga", [55, 0.4, 13, 0.2], [["1 gelas", 250]]),
  drink("cola", "Minuman bersoda (cola)", [42, 0, 10.6, 0], [["1 kaleng", 330]], ["soda", "coca cola", "softdrink"]),
  drink("teh-botol", "Teh kemasan manis", [35, 0, 8.8, 0], [["1 botol", 350]], ["teh botol", "teh pucuk"]),
  drink("air-kelapa", "Air kelapa", [19, 0.7, 3.7, 0.2], [["1 gelas", 250]], ["kelapa muda"]),
  drink("boba", "Bubble tea / boba milk tea", [70, 0.6, 13, 2], [["1 cup", 500]], ["boba", "milk tea"]),
  drink("isotonik", "Minuman isotonik", [26, 0, 6.5, 0], [["1 botol", 500]], ["pocari"]),

  // ---- Bumbu & tambahan ----
  food("minyak", "Minyak goreng", "tambahan", [884, 0, 0, 100], [["1 sdt", 4.5], ["1 sdm", 13]], ["oil"]),
  food("mentega", "Mentega / margarin", "tambahan", [717, 0.9, 0.1, 81], [["1 sdm", 14]], ["butter", "blue band"]),
  food("gula", "Gula pasir", "tambahan", [387, 0, 100, 0], [["1 sdt", 4], ["1 sdm", 12]], ["sugar"]),
  food("madu", "Madu", "tambahan", [304, 0.3, 82, 0], [["1 sdm", 21]], ["honey"]),
  food("kecap-manis", "Kecap manis", "tambahan", [260, 2.6, 62, 0], [["1 sdm", 18]], ["kecap"]),
  food("saus-sambal", "Saus sambal / tomat", "tambahan", [100, 1, 23, 0.3], [["1 sdm", 15]], ["saos"]),
  food("mayones", "Mayones", "tambahan", [680, 1, 0.6, 75], [["1 sdm", 14]], ["mayo", "mayonnaise"]),
  food("santan", "Santan", "tambahan", [230, 2.3, 5.5, 24], [["½ gelas", 100]], ["coconut milk"]),
  food("selai-kacang", "Selai kacang", "tambahan", [588, 25, 20, 50], [["1 sdm", 16]], ["peanut butter"]),
  food("bumbu-kacang", "Bumbu kacang", "tambahan", [330, 12, 20, 23], [["1 sdm", 20]], ["saus kacang"]),
  food("bawang-goreng", "Bawang goreng", "tambahan", [500, 5, 50, 30], [["1 sdm", 5]]),
];

export const FOOD_BY_ID: Record<string, FoodItem> = Object.fromEntries(FOODS.map((f) => [f.id, f]));
