#!/usr/bin/env python3
"""Generates sample WAV files for all languages/voices."""
import argparse
import json
import logging
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

_DIR = Path(__file__).parent

# -----------------------------------------------------------------------------

_TEST_SENTENCES = {
    "bn": """রংধনু বা রামধনু বা ইন্দ্রধনু হল একটি দৃশ্যমান ধনুকাকৃতি আলোর রেখা যা
        বায়ুমণ্ডলে অবস্থিত জলকণায় সূর্যালোকের প্রতিফলন এবং প্রতিসরণের ফলে ঘটিত হয়।
        সাধারণত বৃষ্টির পর আকাশে সূর্যের বিপরীত দিকে রামধনু দেখা যায়। রংধনুতে সাতটি
        রঙের সমাহার দেখা যায়। দেখতে ধনুকের মতো বাঁকা হওয়ায় এটির নাম রংধনু।""",
    "ca": """L'arc de Sant Martí o arc del cel és un fenomen meteorològic òptic
        produït per la reflexió, refracció i dispersió de la llum causada per
        gotes d'aigua en suspensió a la troposfera que resulta en l'aparició al
        cel de l'espectre de la llum visible, interpretat per l'ull humà com els
        colors vermell, taronja, groc, verd, blau, indi i violat.""",
    "af": """'n Reënboog is 'n boog van gekleurde lig wat ontstaan wanneer die
        son teen 'n waterdruppel skyn en die wit lig dan deur middel van
        ligbreking in die volledige kleurspektrum opgebreek word. Die middelpunt
        van die reënboog staan reg teenoor die son en die boog het 'n straal van
        ongeveer 42°. Die kleure van die reënboog is, van buite na binne, rooi,
        oranje, geel, groen, blou, indigo en violet.""",
    "da": """En regnbue er et optisk fænomen; en "lyseffekt", som skabes på
        himlen, når lys fra Solen rammer små vanddråber i luften, f.eks.
        faldende regn. Sådanne svævende vanddråber har facon omtrent som en
        kugle – jo mindre de er, desto mere perfekt kugleform har de. Disse
        kuglerunde dråber bryder, eller "afbøjer" lyset på samme måde som et
        optisk prisme ved en proces, der kaldes refraktion. Og derudover opfører
        indersiden af dråbernes overflader sig til en vis grad som små spejle,
        (et fænomen der kaldes for intern refleksion), der kaster lyset tilbage
        i nogenlunde den retning, det kom fra – det er derfor, man altid ser
        regnbuer i retningen direkte væk fra solen.""",
    "de": """Der Regenbogen ist ein atmosphärisch-optisches Phänomen, das als
        kreisbogenförmiges farbiges Lichtband in einer von der Sonne
        beschienenen Regenwand oder -wolke wahrgenommen wird. Sein radialer
        Farbverlauf ist das mehr oder weniger verweißlichte sichtbare Licht des
        Sonnenspektrums. Das Sonnenlicht wird beim Ein- und beim Austritt an
        jedem annähernd kugelförmigen Regentropfen abgelenkt und in Licht
        mehrerer Farben zerlegt. Dazwischen wird es an der Tropfenrückseite
        reflektiert. Das jeden Tropfen verlassende Licht ist in farbigen
        Schichten konzentriert, die aufeinandergesteckte dünne Kegelmäntel
        bilden. Der Beobachter hat die Regenwolke vor sich und die Sonne im
        Rücken. Ihn erreicht Licht einer bestimmten Farbe aus Regentropfen, die
        sich auf einem schmalen Kreisbogen am Himmel befinden. Der Winkel, unter
        dem der Regenbogen gesehen wird, ist gleich wie der Winkel der
        Kegelmäntel, in dem diese Farben beim Austritt am Regentropfen
        konzentriert sind.""",
    "en": """A rainbow is a meteorological phenomenon that is caused by
        reflection, refraction and dispersion of light in water droplets
        resulting in a spectrum of light appearing in the sky. It takes the form
        of a multi-colored circular arc. Rainbows caused by sunlight always
        appear in the section of sky directly opposite the Sun.""",
    "el": """Οι επιστήμονες μελετούν ακόμη το ουράνιο τόξο. Ο Καρλ Μπ. Μπόγιερ
        παρατηρεί: «Μέσα σε μια σταγόνα βροχής η αλληλεπίδραση της ενέργειας του
        φωτός με την ύλη είναι τόσο στενή ώστε οδηγούμαστε κατευθείαν στην
        κβαντομηχανική και στη θεωρία της σχετικότητας. Αν και γνωρίζουμε αρκετά
        πράγματα για το πώς σχηματίζεται το ουράνιο τόξο, λίγα είναι αυτά που
        έχουμε μάθει για το πώς γίνεται αντιληπτό».""",
    "es": """Un arcoíris​ o arco iris es un fenómeno óptico y meteorológico que
        consiste en la aparición en el cielo de un arco de luz multicolor,
        originado por la descomposición de la luz solar en el espectro visible,
        la cual se produce por refracción, cuando los rayos del sol atraviesan
        pequeñas gotas de agua contenidas en la atmósfera terrestre. Es un arco
        compuesto de arcos concéntricos de colores, sin solución de continuidad
        entre ellos, con el rojo hacia la parte exterior y el violeta hacia el
        interior. A altitud suficiente, por ejemplo cuando se viaja en avión, el
        arcoíris se puede observar en forma de círculo completo.""",
    "fa": """برای دیگر کاربردها رنگین‌کمان (ابهام‌زدایی) را ببینید.  رنگین‌کمان
        دوتایی و رنگین‌کمان‌های اضافی در درون کمان اصلی. سایهٔ سر عکاس مرکز دایرهٔ
        رنگین‌کمان را مشخص می‌کند (نقطهٔ پاد خورشیدی).  رنگین‌کمان پدیده‌ای نوری و
        قیاسی است که زمانی که خورشید به قطرات نم و رطوبت جو زمین می‌تابد باعث
        ایجاد طیفی از نور در آسمان می‌شود. این پدیده به شکل یک کمان رنگین در
        می‌آید.""",
    "fi": """Sateenkaari on spektrin väreissä esiintyvä ilmakehän optinen ilmiö.
        Se syntyy, kun valo taittuu pisaran etupinnasta, heijastuu pisaran
        takapinnasta ja taittuu jälleen pisaran etupinnasta. Koska vesipisara on
        dispersiivinen, valkoinen valo hajoaa väreiksi muodostaen
        sateenkaaren.""",
    "fr": """Un arc-en-ciel est un photométéore, un phénomène optique se
        produisant dans le ciel, visible dans la direction opposée au Soleil
        quand il brille pendant la pluie. C'est un arc de cercle coloré d'un
        dégradé de couleurs continu du rouge, à l'extérieur, au jaune au vert et
        au bleu, jusqu'au violet à l'intérieur.""",
    "gu": """મેઘધનુષ આકાશમાં ખાસ કરીને ચોમાસા દરમિયાન જોવા મળે છે. વરસાદના વાદળ પર
        પડતાં સૂર્યના કિરણોને કારણે આકાશમાં અર્ધગોળાકાર તેમ જ સાત રંગોનું મેઘધનુષ રચાય છે.
        મેઘધનુષમાં સૌથી ઉપર જાંબલી રંગ, પછી નીલો રંગ, પછી વાદળી રંગ, પછી લીલો રંગ, પછી
        પીળો રંગ, પછી નારંગી રંગ તેમ જ છેલ્લે લાલ રંગ એમ સાત રંગો જોવા મળે છે. ગોળાકાર
        હોવાથી તે ધનુષ જેવું દેખાય છે અને આ ગોળાકાર આકાર પૃથ્વીના ગોળ હોવાને કારણે સર્જાય
        છે.""",
    "ha": """Rainbow wani muhimmin haske ne da yake bayyana a cikin giza-gizai a
        sararin samaniya wanda zaka ga yayi lankwasa kamar misalin baka ya
        dangana daga kusurwa zuwa kusurwa. A turance ana kiransa Rainbow. Shi dai
        wannan abu yana dauke da kaloli daban-daban har kusan guda bakwai, mafi
        akasari yana bayyana ne lokacin da hadari ya taso, cikin ikon Allah da
        zarar bakan gizo ya bayyana, nan take zaka ga hadarin ya lafa ma'ana zai
        washe zuwa wani dan lokaci daga nan kuma sai Ruwa ya kece. Amma mafi
        akasari wani lokacin sam baza ma ayi ruwan ba.""",
    "hu": """A szivárvány olyan optikai jelenség, melyet eső- vagy páracseppek
        okoznak, mikor a fény prizmaszerűen megtörik rajtuk és színeire bomlik,
        kialakul a színképe, más néven spektruma. Az ív külső része vörös, míg a
        belső ibolya. Előfordul az ún. dupla szivárvány is, amelynél egy másik,
        halványabb ív is látható fordított sorrendű színekkel.""",
    "it": """In fisica dell'atmosfera e meteorologia l'arcobaleno è un fenomeno
        ottico atmosferico che produce uno spettro quasi continuo di luce nel
        cielo quando la luce del Sole attraversa le gocce d'acqua rimaste in
        sospensione dopo un temporale, o presso una cascata o una fontana. Lo
        spettro elettromagnetico dell'arcobaleno include lunghezze d'onda sia
        visibili sia non visibili all'occhio umano, queste ultime rilevabili
        attraverso uno spettrometro.""",
    "jv": """Kluwung, kuwung, wangkawa utawa éndracapa iku pratanda optik lan
        météorologi wujud cahya manéka warna jinèjèr mlengkung ing langit utawa
        papan liyané. Ing langit, kluwung katon kaya gandéwa cahya kang pucuké
        ngarah ing horizon nalika udan riwis-riwis. Kluwung uga bisa katon ing
        sacedhaké grojogan. Racaké udan anané ing wektu soré, saéngga kluwung
        katon ing sisih wétan. Déné menawa ésuk, kluwung katon ing kulon,
        diarani téja.""",
    "kk": """Кемпірқосақ – аспан күмбезінде түрлі түсті доға түрінде көрінетін
        атмосферадағы оптикалық құбылыс. Ол аспанның бір жағында торлаған
        бұлттан жаңбыр жауып, қарсы жағында жарқырап күн шығып тұрған кезде
        көрінеді.  Кемпірқосақ тікелей түскен күн сәулесінің жаңбыр тамшыларынан
        өткенде сынып, құрамдас бөліктерге (қызыл, сарғылт, сары, жасыл,
        көгілдір, көк, күлгін) бөлінуінің және тамшы бетінен шағылған толқын
        ұзындығы әр түрлі сәулелердің дифракциялануы мен интерференциялануы
        нәтижесінде пайда болады.  Кемпірқосақтың айқындығы жаңбыр тамшыларының
        үлкен-кішілігіне байланысты өзгеріп отырады. Тамшы үлкен болса
        кемпірқосақ айқын, жарық болып көрінеді.  Кейде алғашқы кемпірқосақпен
        бірге екінші кемпірқосақ қабаттаса көрінеді, оны қос кемпірқосақ деп
        атайды. Қос кемпірқосақ күн сәулесінің су тамшысына белгілі бұрыш жасай,
        екі рет шағылысуынан түзіледі. Сонымен бірге ай сәулесінен пайда болатын
        кемпірқосақты ай кемпірқосағы деп атайды.""",
    "ko": """무지개(문화어: 색동다리)는 하늘에 보이는 호(弧)를 이루는 색 띠를
        말한다. 색 경계가 분명하지 않아 각 문화권마다 색의 개수가 다르게
        인식되기도 한다.  대부분 지표로부터 하늘에 걸쳐서 나타나는 반원형 고리
        모양으로 나타난다.  공기 중에 떠 있는 수많은 물방울에 햇빛이나 달빛
        이닿아 물방울 안에서 굴절과 반사가 일어날 때, 물방울이 프리즘과 같은
        작용을 하여 분산되어 나타나는 현상이다.  세계에서 가장 오랫동안 관측된
        무지개는 2017년 11월 27일 중화민국 타이베이에서 관측된 것으로, 9시간
        내내 무지개가 떠올랐다.""",
    "ne": """इन्द्रेणी वा इन्द्रधनुष प्रकाश र रंगबाट उत्पन्न भएको यस्तो घटना हो जसमा रंगीन
        प्रकाशको एउटा अर्धवृत आकाशमा देखिन्छ। जब सूर्यको प्रकाश पृथ्वीको वायुमण्डलमा भएको
        पानीको थोपा माथि पर्छ, पानीको थोपाले प्रकाशलाई परावर्तन, आवर्तन र डिस्पर्सन
        गर्दछ। फलस्वरुप आकाशमा एउटा सप्तरङ्गी अर्धवृताकार प्रकाशीय आकृति उत्पन्न हुन्छ। यो
        आकृतिलाई नै इन्द्रेणी भनिन्छ। इन्द्रेणी देखिनुको कारण वायुमण्डलमा पानीका कणहरु हुनु नै
        हो। वर्षा, झरनाबाट उछिट्टिएको पानी, शीत, कुहिरो आदिको इन्द्रेणी देखिने प्रक्रियामा
        महत्त्वपूर्ण भूमिका हुन्छ। इन्द्रेणीमा सात रंगहरु रातो, सुन्तला, पहेंलो, हरियो, आकाशे
        निलो, गाढा निलो र बैजनी रंग क्रमैसँग देखिन्छ। यसमा सबैभन्दा माथिल्लो छेउमा रातो रंग
        र अर्को छेउमा बैजनी रंग देखिन्छ। इन्द्रेणी पूर्ण वृत्ताकार समेत हुन सक्ने भए पनि साधरण
        अवलोकनकर्ताले जमिन माथि बनेको आधा भाग मात्र देख्न सकिन्छ ।""",
    "nl": """Een regenboog is een gekleurde cirkelboog die aan de hemel
        waargenomen kan worden als de, laagstaande, zon tegen een nevel van
        waterdruppeltjes aan schijnt en de zon zich achter de waarnemer bevindt.
        Het is een optisch effect dat wordt veroorzaakt door de breking en
        weerspiegeling van licht in de waterdruppels.""",
    "no": """Regnbuen eller regnbogen er et optisk fenomen som oppstår når solen
        skinner gjennom regndråper i atmosfæren og betrakteren står med solen i
        ryggen. Gulhvitt sollys består av alle synlige bølgelengder av lys.
        Lysbrytningen er forskjellig avhengig av bølgelengden slik at sollyset
        spaltes til et spektrum av rødt ytterst og deretter oransje, gult,
        grønt, blått, indigo (blålilla) og fiolett.  En fullstendig regnbue har
        en tydelig hovedregnbue (primærbue) innerst og en svakere regnbue
        (sekundærbue) ytterst der fargene ligger i omvendt rekkefølge.""",
    "pl": """Tęcza, zjawisko optyczne i meteorologiczne, występujące w postaci
        charakterystycznego wielobarwnego łuku powstającego w wyniku
        rozszczepienia światła widzialnego, zwykle promieniowania słonecznego,
        załamującego się i odbijającego wewnątrz licznych kropli wody mających
        kształt zbliżony do kulistego.  Rozszczepienie światła jest wynikiem
        zjawiska dyspersji, powodującego różnice w kącie załamania światła o
        różnej długości fali przy przejściu z powietrza do wody i z wody do
        powietrza.""",
    "pt": """Um arco-íris, também popularmente denominado arco-da-velha, é um
        fenômeno óptico e meteorológico que separa a luz do sol em seu espectro
        contínuo quando o sol brilha sobre gotículas de água suspensas no ar. É
        um arco multicolorido com o vermelho em seu exterior e o violeta em seu
        interior. Por ser um espectro de dispersão da luz branca, o arco-íris
        contém uma quantidade infinita de cores sem qualquer delimitação entre
        elas. Devido à necessidade humana de classificação dos fenômenos da
        natureza, a capacidade finita de distinção de cores pela visão humana e
        por questões didáticas, o arco-íris é mais conhecido por uma
        simplificação criada culturalmente que resume o espectro em sete cores
        na seguinte ordem: vermelho, laranja, amarelo, verde, azul, anil e
        violeta. Tal simplificação foi proposta primeiramente por Isaac Newton,
        que decidiu nomear apenas cinco cores e depois adicionou mais duas
        apenas para fazer analogia com as sete notas musicais, os sete dias da
        semana e os sete objetos do sistema solar conhecidos à época.  Para
        informações sobre o espectro de cores do arco-íris, veja também o artigo
        sobre cores.""",
    "ru": """Ра́дуга, атмосферное, оптическое и метеорологическое явление,
        наблюдаемое при освещении ярким источником света множества водяных
        капель.  Радуга выглядит как разноцветная дуга или окружность,
        составленная из цветов спектра видимого излучения. Это те семь цветов,
        которые принято выделять в радуге в русской культуре, но следует иметь в
        виду, что на самом деле спектр непрерывен, и его цвета плавно переходят
        друг в друга через множество промежуточных оттенков.""",
    "sv": """En regnbåge är ett optiskt, meteorologiskt fenomen som uppträder som
        ett fullständigt ljusspektrum i form av en båge på himlen då solen lyser
        på nedfallande regn. Regnbågen består färgmässigt av en kontinuerlig
        övergång från rött via gula, gröna och blå nyanser till violett innerst;
        ofta definieras antalet färger som sju, inklusive orange och indigo.""",
    "sw": """Upinde wa mvua ni tao la rangi mbalimbali angani ambalo linaweza
        kuonekana wakati Jua huangaza kupitia matone ya mvua inayoanguka. Mfano
        wa rangi hizo huanza na nyekundu nje na hubadilika kupitia rangi ya
        chungwa, njano, kijani, bluu, na urujuani ndani. Rangi hizi na ufuatano
        ni sehemu ya spektra ya nuru. Upinde wa mvua huundwa wakati mwanga
        umepinda ukiingia matone ya maji, umegawanyika kuwa rangi tofauti, na
        kurudishwa nyuma. Hapa spektra ya nuru inayoonekana ambayo sisi tunaona
        kwa macho kama nyeupe tu.""",
    "te": """ఇంద్ర ధనుస్సు దృష్టి విద్యా సంబంధమయిన వాతావరణ శాస్త్ర సంబంధమయిన దృగ్విషయం. అది
        నీటిబిందువులపై కాంతి పరావర్తనం, వక్రీభవనం ద్వారా సంబవిస్తుంది. అది ఆకాశంలో రంగురంగుల చాపం
        రూపంలో ఉంటుంది. ఈ చర్య వల్ల రశ్మి వాతావరణం లోని నీటి బిందువులతో అంతఃపరావర్తనం చెంది,
        వర్ణానుసారం విచ్ఛిన్నమయి ఏడు రంగులుగా మారుతుంది. అది ఒక అర్ధవృత్తాకారంలో రెండు అంచులూ భూమిలో
        ఉన్నట్టు, వృత్తాకారం ఆకాశం వైపుకున్నట్టు గోచరిస్తుంది.  సూర్యరశ్మి ద్వారా తయారయ్యే ఇంద్రధనుస్సు,
        ఎల్లపుడూ సూర్యునికి వ్యతిరేక దిశలోనే కనిపిస్తుంది. ఇక రంగుల అమరికను బట్టీ ఇంద్రధనుస్సుని
        రెండు రకాలుగా చెప్పొచ్చు. ఒకటి - ప్రాథమిక ఇంద్రధనుస్సు; రెండు ద్వితీయ ఇంద్రధనుస్సు. మొదటి
        ఇంద్రధనుస్సులో వృత్తం పై భాగంలో ఎరుపు,, లోపలి భాగంలో ఊదా రంగులో ఉంటాయి. అదే ద్వితీయ
        ఇంద్రధనుస్సులో ప్రాథమిక ఇంద్రధనుస్సుతో పాటు అదే వర్ణాలు తిరగవేసి కనిపిస్తాయి. మొదటి రకం ఇంద్ర
        ధనుస్సు పరిపూర్ణ అంతఃపరావర్తనం ద్వారా జరిగితే, ద్వితీయ ఇంద్రధనుస్సు వాతావరణంలోని నీటి బిందువుల్లో
        రెండు మార్లు పరావర్తనం అవటం వల్ల తయారవుతుంది.""",
    "tn": """Batho botlhe ba tsetswe ba gololosegile le go lekalekana ka seriti
        le ditshwanelo. Ba abetswe go akanya le maikutlo, mme ba tshwanetse go
        direlana ka mowa wa bokaulengwe.""",
    "uk": """Весе́лка, також ра́йдуга оптичне явище в атмосфері, що являє собою
        одну, дві чи декілька різнокольорових дуг (або кіл, якщо дивитися з
        повітря), що спостерігаються на тлі хмари, якщо вона розташована проти
        Сонця. Червоний колір ми бачимо з зовнішнього боку первинної веселки, а
        фіолетовий — із внутрішнього.""",
    "vi": """Cầu vồng hay mống cũng như quang phổ là hiện tượng tán sắc của các
        ánh sáng từ Mặt Trời khi khúc xạ và phản xạ qua các giọt nước mưa. Ở
        nhiều nền văn hóa khác nhau, cầu vồng xuất hiện được coi là mang đến
        điềm lành cho nhân thế.""",
    "yo": """E̟nì kò̟ò̟kan ló ní è̟tó̟ láti kó̟ è̟kó̟. Ó kéré tán, è̟kó̟ gbo̟dò̟ jé̟ ò̟fé̟ ní
        àwo̟n ilé-è̟kó̟ alákò̟ó̟bè̟rè̟. E̟kó̟ ní ilé-è̟kó̟ alákò̟ó̟bè̟rè̟ yìí sì gbo̟dò̟ jé̟
        dandan. A gbo̟dò̟ pèsè è̟kó̟ is̟é̟-o̟wó̟, àti ti ìmò̟-è̟ro̟ fún àwo̟n ènìyàn lápapò̟.
        Àn fàní tó dó̟gba ní ilé-è̟kó̟ gíga gbo̟dò̟ wà ní àró̟wó̟tó gbogbo e̟ni tó bá
        tó̟ sí.""",
    "zh": """彩虹，又稱天弓、天虹、絳等，簡稱虹，是氣象中的一種光學現象，當太陽
        光照射到半空中的水滴，光線被折射及反射，在天空上形成拱形的七彩光譜，由外
        圈至内圈呈紅、橙、黃、綠、蓝、靛蓝、堇紫七种颜色（霓虹則相反）。事實
        上彩虹有无数種顏色，比如，在紅色和橙色之間還有許多種細微差別的顏色，根據
        不同的文化背景被解讀爲3-9種不等，通常只用六七種顏色作為區別。國際LGBT
        聯盟的彩虹旗为六色：紅橙黃綠藍紫。紅橙黃綠藍靛紫的七色說，就是在六色基礎
        上將紫色分出偏藍色的靛。傳統中國文化說的七色是：赤橙黃綠青藍紫，青色
        就是偏藍的綠色。要是把橙色也分爲偏紅、偏黃的兩種就是九色。三色說有：紅綠
        藍，就是光學三原色，所有顏色的光都是這三種顏色混合出來的，和亚里士多
        德紅、綠、紫三色說，就是兩頭加中間。""",
}

_LOGGER = logging.getLogger("get_samples")

# -----------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        default=_DIR.parent / "samples",
        help="Path to output samples directory",
    )
    parser.add_argument(
        "model",
        nargs=2,
        action="append",
        default=[],
        help="Language + path to onnx model",
    )
    parser.add_argument("--max-workers", type=int, default=1)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    with ThreadPoolExecutor(max_workers=args.max_workers) as executor:
        for language, model in args.model:
            model_path = Path(model)
            text = _TEST_SENTENCES.get(language)
            assert text, f"No test text for {language}"

            # Fix newlines and normalize whitespace
            text = " ".join(text.split()).strip()

            with open(f"{model}.json", "r", encoding="utf-8") as config_file:
                config = json.load(config_file)

            num_speakers = config["num_speakers"]
            inference = config.get("inference", {})
            length_scale = inference.get("length_scale")
            noise_scale = inference.get("noise_scale")
            noise_w = inference.get("noise_w")

            for speaker_id in range(num_speakers):
                samples_dir = output_dir / model_path.stem / f"speaker_{speaker_id}"
                samples_dir.mkdir(parents=True, exist_ok=True)

                cmd = [
                    "piper",
                    "--output_dir",
                    str(samples_dir.absolute()),
                    "--model",
                    str(model_path.absolute()),
                ]

                if length_scale is not None:
                    cmd.extend(["--length-scale", str(length_scale)])

                if noise_scale is not None:
                    cmd.extend(["--noise-scale", str(noise_scale)])

                if noise_w is not None:
                    cmd.extend(["--noise-w", str(noise_w)])

                if num_speakers > 1:
                    cmd.extend(["--speaker", str(speaker_id)])

                executor.submit(generate_sample, cmd, samples_dir, text)


def generate_sample(cmd, samples_dir, text):
    try:
        with subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            universal_newlines=True,
        ) as proc:
            print(text, file=proc.stdin, flush=True)
            wav_path = Path(proc.stdout.readline().strip())
            opus_path = samples_dir / "sample.opus"
            subprocess.check_call(
                ["ffmpeg", "-y", "-i", str(wav_path), str(opus_path)],
            )
            wav_path.unlink()

            text_path = samples_dir / "sample.txt"
            text_path.write_text(text, encoding="utf-8")
    except Exception:
        _LOGGER.exception(cmd)


# -----------------------------------------------------------------------------

if __name__ == "__main__":
    main()
