/**
 * Reviewed duplicate pairs: [keep, drop].
 *
 * Extracted from `merge-duplicate-people.ts` so the orphan purge reads the same
 * list. It is a hard-coded literal on purpose — re-deriving it from the sheet
 * would pick the six same-email-different-people pairs straight back up, and
 * deleting the wrong row costs a prospect.
 */
export const MERGED_PAIRS: [keep: string, drop: string][] = [
  ["P00038", "P02342"], // Chittari Ramachandrudu ← C RAMA CHANDRUDU
  ["P00167", "P05595"], // Ramesh Kumar Malyala ← M.Ramesh Kumar
  ["P00355", "P05558"], // Govinda Rao Gopal ← G Gopal
  ["P00536", "P05556"], // Rajashekhar Nandeppa Topagi ← Rajashekhar N Topagi
  ["P01123", "P01041"], // Athikarappan Arivazhagan ← A ARIVAZHAGAN (both Madurai)
  ["P01230", "P02565"], // Duraimuthu ← P. DURAI MUTHU
  ["P01674", "P01071"], // Rakkappan Anbazhagan ← ANBAZHAGAN A
  ["P02154", "P05588"], // N Baburao ← Nallapu Babu rao (N = Nallapu)
  ["P02180", "P05594"], // Peddi Satya Narayana Reddy ← P. Satya Narayana Reddy
  ["P03195", "P05545"], // Abhishek Kirankumar Shah ← Abhishek K Shah
  ["P03277", "P05540"], // Drugesh Kiritbhai Shah ← Durgesh Kirit Shah
  ["P03300", "P05530"], // Harish Champaklal Bhavsar ← Harish C. Bhavsar
  ["P03393", "P05555"], // Mehta Nimish ← Nimish Rumendra Mehta
  ["P03404", "P05528"], // Mital Pravinchandra Sanghvi ← Mital Sanghvi
  ["P03427", "P05548"], // Nihirbabu Dave ← Nihirbabu Balvantray Dave
  ["P03505", "P05529"], // Priyank Nayak ← Priyank Nitin Kumar Nayak
  ["P03534", "P05550"], // Raval Nimeshkumar Manuprasad ← Mr. Nimesh Manuprasad Raval
  ["P03590", "P05532"], // Shvetangkumar Narsinhbhai Patel ← Shvetang N. Patel
  ["P03597", "P02735"], // Suresh Dewandas Harwani ← SURESH D HARWANI
  ["P03605", "P05533"], // Thakkar Mukeshkumar ← Mukeshkumar Bansilal Thakkar
  ["P03624", "P05534"], // Vikrambhai Rajnikantbhai Bhatt ← Vikram Rajnikant Bhatt
  ["P04432", "P05615"], // Ram Dunichand Tarachandani ← Ram D Tarachandani
  ["P04570", "P05625"], // Suresh Baliram Piplewar ← Suresh Piplewar
  ["P04726", "P05568"], // Bharat Bhushan Goyal ← Bharat Bhushan

  // Reviewed 2026-09-21, after the first 24. Each was held back as uncertain
  // until something decided it; the evidence is recorded here because none of
  // it is recoverable from the two names alone.
  ["P04569", "P05626"], // Surendra Bhaurao Gordey ← SB Girdey — the shared address
                        // sbgordeygroup@rediffmail.com spells the keeper's surname,
                        // so "Girdey" is a typo and SB is Surendra Bhaurao.
  ["P01155", "P01523"], // Balasundaram … Thanaraj ← N T BALASUNDARAM — the address is
                        // the panel row's name, and the panel phone's 04362 is the
                        // Thanjavur STD code, matching the keeper rather than the
                        // "Madurai" the panel row claims.
  ["P01705", "P01622"], // Rasappan Ramasamy ← R RAMASAMY — R is Rasappan. The cities
                        // disagree (Salem / Chennai, keeper's own address in Karur);
                        // a valuer works across cities, so `city` is merged, not picked.
  ["P03709", "P05585"], // Parveen Kumar Gupta ← Praveen Kumar — decided by the panel
                        // row's own remarks, which carry "1A, Shiv Pratap Nagar, Mahesh
                        // Nagar, Ambala Cantt, Haryana-133001": the keeper's address,
                        // pincode included. Its "Punjab" is the PNB Chandigarh zone
                        // rather than where the person is, and the PAN AFIPG4375B
                        // carries the G of the Gupta the panel row drops.

  // Reviewed 2026-09-21. A class neither the sheet's `duplicate_flag` nor the
  // email pass can see: the formula compares IBBI, email and phone and never
  // the name, and these pairs share only a name — one full IBBI row against a
  // bare harvest row carrying a name and a location. Corroborated first:
  ["P00778", "P00763"], // Jayadevi P R ← JAYADEVI PR — same address, "Swathikam
                        // House, Thevakkal Vadakode P O" / "SWATHIKAN, VADACODE P.O., THEVAKKAL".
  ["P03935", "P03930"], // Khojema Teen Wala ← KHOJEMA TEENWALA — both trade as
                        // Global ("GLOBAL ARCHITECT" / globalmds165@gmail.com).
  ["P00364", "P00368"], // H R Krishnegowda ← HR KRISHNEGOWDA (Bangalore/Bengaluru)
  ["P00393", "P00402"], // K S Nagarajaiah ← KS NAGARAJAIAH (Bangalore/Bengaluru)
  ["P00394", "P00403"], // K S Venkatakrishnan ← KS VENKATAKRISHNAN (Bangalore/Bengaluru)
  ["P00413", "P00401"], // Krishna Murthy T ← KRISHNAMURTHY T (Bangalore/Bengaluru)
  ["P02048", "P02043"], // Bheemrao Jaligama ← BHEEM RAO JALIGAMA (both Hyderabad)
  ["P02052", "P02045"], // Burugu Jagan Mohan ← BURUGU JAGANMOHAN (both Hyderabad)
  ["P01747", "P02649"], // S P Vee Vengadaraagavan ← S P VEE VENGADA RAAGAVAN

  // Name only, with a bare counterpart holding no IBBI, email or address to
  // contradict it. Weaker evidence than anything above — accepted because the
  // fold carries the bare row's few fields onto the keeper first, so the cost
  // of being wrong here is a location string, not a prospect's record.
  ["P00011", "P02291"], // Anilkumar Valluri ← ANIL KUMAR VALLURI
  ["P00165", "P02620"], // Ramakrishna Gorti ← RAMA KRISHNA GORTI
  ["P00719", "P02332"], // BIJOY VD ← BIJOY .V.D — neither has an IBBI number, so
                        // the keeper is the row with an address rather than the registered one.
  ["P01265", "P02388"], // Geetha Rani ← GEETHARANI
  ["P01625", "P02608"], // R S Vinothkumar ← R.S.VINOTH KUMAR
  ["P01743", "P02646"], // S Kasi Viswanathan ← S KASIVISWANATHAN
  ["P01757", "P02651"], // S Rajakumar ← S RAJA KUMAR
  ["P00470", "P00480"], // N K Rajkumar ← NK RAJKUMAR (Tumkur / Bengaluru)
  ["P00534", "P00525"], // Raghu C R ← RAGHU CR (Tumkur / Bengaluru)
  ["P00644", "P00639"], // Thippeswamy C A ← THIPPESWAMY CA (Sira Taluk / Bengaluru)
  ["P01768", "P01762"], // S Saravanakumar ← S SARAVANA KUMAR (Theni / Madurai)
  ["P01920", "P01912"], // Sundarraj R ← Sundar Raj R (both Namakkal)
  ["P03667", "P03666"], // Babudan Singh Tanwar ← Babu Dan Singh Tanwar (both Haryana)

  // Reviewed 2026-09-21, third pass. Rejected on a first reading for naming
  // different places, then reinstated once the addresses were read: both are
  // West Godavari, ~30km apart (Tanuku / Ganapavaram). The "Hyderabad" that
  // made it look like two people is the drop row's PNB ZONE sitting in `city`,
  // which is why zoneCity below refuses to carry that column across.
  ["P00223", "P00222"], // Vasudevaraju Dandu ← Vasudeva Raju Dandu

  // Reviewed 2026-09-26. Found because a research pass wrote its own verdict
  // into the five formula columns (see fix-formula-column-blockers.ts) and the
  // restored `duplicate_flag` then flagged the pair independently. Same email,
  // same mobile, same Kadapa address, same two panels; the survivor already
  // carries a 2026-09-23 note confirming the IBBI register match.
  ["P00054", "P05674"], // G Neelakanta Reddy ← Gouru Neelakanta Reddy
];
