/* ============================================================
   HACKATHON PROJECT DATA
   Only hackathons with project details are listed here.
   Keys match the data-hack-key attribute on each card in the HTML.

   Fields:
     project     - project name (required)
     description - longer description paragraph (optional)
     duration    - e.g. "36 hours" (optional)
     team        - e.g. "4 teammates" or "Solo" (optional)
     tech        - array of tech/tools used (optional)
     awards      - prize or placement string (optional)
     links       - array of { label, url } (optional)
     media       - array of { type, src, alt?, id? } (optional)
     quote       - { text, author, url } testimonial callout (optional)
   ============================================================ */
var HACKATHON_DATA = {
    'boilermake_2014': {
        project: '',
        description: '',
        duration: '',
        team: '',
        tech: [],
        awards: '',
        links: [],
        media: []
    },
    'wildhacks_2014': {
        project: 'The Piano',
        description: 'Uses Leap Motion to simulate a virtual keyboard with 3 octaves. Gesture-controlled instrument that detects hand motion to play notes.',
        duration: '36 hours',
        team: '3 teammates',
        tech: ['Leap Motion'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/the-piano' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/wildhacks_2014/photo_01.png', alt: 'The Piano' },
            { type: 'image', src: '../../static/www/img/hackathons/wildhacks_2014/devpost_01.jpg', alt: 'The Piano' },
            { type: 'image', src: '../../static/www/img/hackathons/wildhacks_2014/devpost_02.jpg', alt: 'The Piano' },
            { type: 'image', src: '../../static/www/img/hackathons/wildhacks_2014/devpost_03.jpg', alt: 'The Piano' },
            { type: 'image', src: '../../static/www/img/hackathons/wildhacks_2014/devpost_04.jpg', alt: 'The Piano' },
            { type: 'image', src: '../../static/www/img/hackathons/wildhacks_2014/devpost_05.jpg', alt: 'The Piano' },
            { type: 'image', src: '../../static/www/img/hackathons/wildhacks_2014/devpost_06.jpg', alt: 'The Piano' },
            { type: 'image', src: '../../static/www/img/hackathons/wildhacks_2014/devpost_07.jpg', alt: 'The Piano' }
        ]
    },
    'hackIllinois_2015': {
        project: 'Rockalanche',
        description: 'Experience earthbending in a 60 second target practice using an Oculus Rift and two Myo arm bands.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['Unity', 'C#', 'Oculus Rift', 'Myo'],
        awards: 'Best Myo Hack',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/rockalanche' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/hackIllinois_2015/photo_01.png', alt: 'Rockalanche' },
            { type: 'image', src: '../../static/www/img/hackathons/hackIllinois_2015/devpost_01.png', alt: 'Rockalanche' },
            { type: 'image', src: '../../static/www/img/hackathons/hackIllinois_2015/devpost_02.jpg', alt: 'Rockalanche' },
            { type: 'image', src: '../../static/www/img/hackathons/hackIllinois_2015/devpost_03.jpg', alt: 'Rockalanche' },
            { type: 'image', src: '../../static/www/img/hackathons/hackIllinois_2015/devpost_04.jpg', alt: 'Rockalanche' }
        ]
    },
    'spartahack_2015': {
        project: 'Pokemon Rift',
        description: 'A 3D Pokemon battle game for the Oculus Rift, Myo, and Leap Motion.',
        duration: '36 hours',
        team: '2 teammates',
        tech: ['Unity', 'C#', 'Blender', 'Oculus', 'Myo', 'Leap Motion'],
        awards: '3rd Place, Funniest/Most Creative Hack',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/pokemon-rift' },
            { label: 'GitHub', url: 'https://github.com/Scub3d/Project-Pokemon' }
        ],
        media: [
            { type: 'youtube', id: 'dhK0XiPUs9E' },
            { type: 'image', src: '../../static/www/img/hackathons/spartahack_2015/devpost_01.png', alt: 'Pokemon Rift' },
            { type: 'image', src: '../../static/www/img/hackathons/spartahack_2015/photo_01.jpg', alt: 'Pokemon Rift' },
            { type: 'image', src: '../../static/www/img/hackathons/spartahack_2015/photo_02.jpg', alt: 'Pokemon Rift' },
            { type: 'image', src: '../../static/www/img/hackathons/spartahack_2015/photo_03.jpg', alt: 'Pokemon Rift' },
            { type: 'image', src: '../../static/www/img/hackathons/spartahack_2015/photo_04.jpg', alt: 'Pokemon Rift' },
            { type: 'image', src: '../../static/www/img/hackathons/spartahack_2015/photo_05.jpg', alt: 'Pokemon Rift' },
            { type: 'image', src: '../../static/www/img/hackathons/spartahack_2015/photo_06.jpg', alt: 'Pokemon Rift' }
        ]
    },
    'revolutionuc_2015': {
        project: 'Project Wind Waker',
        description: 'The Legend of Zelda: The Wind Waker on the Oculus in first person. Players control Link on Outset Island with sword and shield mechanics.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['Unity', 'C#', 'Blender', 'Oculus', 'Leap Motion', 'Myo', 'Muse', 'Android'],
        awards: 'Best Use of Wearables',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/project-wind-waker' },
            { label: 'GitHub', url: 'https://github.com/Scub3d/Project-WindWaker' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/revolutionuc_2015/photo_01.jpg', alt: 'Project Wind Waker' },
            { type: 'image', src: '../../static/www/img/hackathons/revolutionuc_2015/photo_02.jpg', alt: 'Project Wind Waker' },
            { type: 'image', src: '../../static/www/img/hackathons/revolutionuc_2015/photo_03.jpg', alt: 'Project Wind Waker' },
            { type: 'image', src: '../../static/www/img/hackathons/revolutionuc_2015/photo_04.jpg', alt: 'Project Wind Waker' },
            { type: 'image', src: '../../static/www/img/hackathons/revolutionuc_2015/photo_05.jpg', alt: 'Project Wind Waker' },
            { type: 'image', src: '../../static/www/img/hackathons/revolutionuc_2015/photo_06.jpg', alt: 'Project Wind Waker' }
        ]
    },
    'khe_2015': {
        project: 'Project Pac-Man',
        description: 'First person Pac-Man on the Rift utilizing Myo arm band controls for ghost-shooting and Pebble smartwatch for in-game movement.',
        duration: '36 hours',
        team: '2 teammates',
        tech: ['C#', 'GLSL', 'JavaScript'],
        awards: '3rd Place, Best Use of Pebble',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/project-pac-man' },
            { label: 'GitHub', url: 'https://github.com/Scub3d/Project-PAC-MAN' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/khe_2015/photo_01.jpg', alt: 'Project Pac-Man' },
            { type: 'image', src: '../../static/www/img/hackathons/khe_2015/photo_02.jpg', alt: 'Project Pac-Man' }
        ]
    },
    'boilermake_2015': {
        project: 'iAssassins',
        description: 'Play the popular game Assassins with your friends or strangers! Built using iOS, iBeacon, and Firebase.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['iOS', 'Swift', 'Firebase', 'iBeacon'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/iassassins' },
            { label: 'GitHub', url: 'https://github.com/heymarion/iAssassins' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/boilermake_2015/devpost_01.jpg', alt: 'iAssassins' }
        ]
    },
    'junction_2015': {
        project: 'VR So Fly',
        description: 'A complete in-flight entertainment and information system leveraging VR to enhance passenger experience with real-time flight data and points of interest.',
        duration: '48 hours',
        team: '4 teammates',
        tech: ['Unity', 'C#', 'Oculus Rift DK2'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/vr-so-fly' },
            { label: 'GitHub', url: 'https://github.com/Scub3d/Aerohacks' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/junction_2015/devpost_01.jpg', alt: 'VR So Fly' },
            { type: 'image', src: '../../static/www/img/hackathons/junction_2015/devpost_02.jpg', alt: 'VR So Fly' },
            { type: 'image', src: '../../static/www/img/hackathons/junction_2015/devpost_03.jpg', alt: 'VR So Fly' },
            { type: 'image', src: '../../static/www/img/hackathons/junction_2015/devpost_04.jpg', alt: 'VR So Fly' },
            { type: 'image', src: '../../static/www/img/hackathons/junction_2015/devpost_05.jpg', alt: 'VR So Fly' }
        ]
    },
    'fashion-tech-hacks': {
        project: 'Snow Smart',
        description: 'A smart snow sports jacket that allows for comfort, style, and tech savageness.',
        duration: '',
        team: '2 teammates',
        tech: ['Arduino', 'C', 'C++', 'Python', 'Raspberry Pi'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/smart-vest' }
        ],
        media: []
    },
    'intel_security_research': {
        project: 'Intel Automotive Security Research Workshop',
        description: 'Invited by Intel to a 3-day hands-on automotive security research workshop. Teams worked on an Intel Linux-based in-vehicle infotainment (IVI) simulation platform to identify vulnerabilities in Wi-Fi, Bluetooth, CAN bus, and software update mechanisms, and propose mitigation strategies. Findings were published in a joint research summary with Intel IoT and Wind River Systems.',
        duration: '3 Days',
        team: '',
        tech: ['Research', 'Security'],
        awards: 'Funniest Exploit',
        links: [
            { label: 'PDF', url: '//static.scub3d.io/www/downloads/automotive-security-research-workshops-summary.pdf' }
        ],
        media: []
    },
    'hackIllinois_2016': {
        project: 'Achieve! Mobile App',
        description: 'A recipe application for Achieve! Weight Loss that allows users to view detailed recipe components and create custom recipes based on nutritional guidance.',
        duration: '36 hours',
        team: '2 teammates',
        tech: ['Android', 'Android Studio', 'Firebase', 'Java', 'MongoDB', 'XML'],
        awards: 'Best Product for Small Business Owners (GoDaddy)',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/achieve-mobile-app' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/hackIllinois_2016/devpost_01.png', alt: 'Achieve! Mobile App' },
            { type: 'image', src: '../../static/www/img/hackathons/hackIllinois_2016/devpost_02.png', alt: 'Achieve! Mobile App' }
        ]
    },
    'spartahack_2016': {
        project: 'Ekko eSports: VR Soccer',
        description: 'VR Mario soccer using Myos to control the avatars with Amazon Alexa eSports integration.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['Unity', 'C#', 'JavaScript', 'Node.js'],
        awards: 'Top 10, Best Alexa Integration',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/we-ll-come-back-to-this-later' }
        ],
        media: [
            { type: 'youtube', id: 'hHZEmpGAT6Y' }
        ]
    },
    'grizzhacks_2016': {
        project: 'Project Snap',
        description: 'Pokemon Snap for the Oculus, Myo, and Leap Motion. An immersive VR experience allowing players to photograph creatures in a reimagined first-level environment.',
        duration: '24 hours',
        team: '2 teammates',
        tech: ['Unity', 'C#', 'Blender', 'Android', 'Java', 'Python'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/project-snap' },
            { label: 'GitHub', url: 'https://github.com/Scub3d/_ProjectSnap' }
        ],
        media: [
            { type: 'youtube', id: 'M8n3PJQwelo' }
        ]
    },
    'global-archiact-jam': {
        project: 'Low Poly Safari',
        description: 'A virtual reality safari game for Google Cardboard where users explore the Savannah with a camera and tranquilizer gun, photographing animals.',
        duration: '',
        team: '3 teammates',
        tech: ['Unity', 'Blender', 'Android'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/low-poly-safari' },
            { label: 'GitHub', url: 'https://github.com/Scub3d/Low-Poly-Safari' }
        ],
        media: [
            { type: 'youtube', id: 'EniKlZ0lMXg' },
            { type: 'image', src: '../../static/www/img/hackathons/global-archiact-jam/devpost_01.png', alt: 'Low Poly Safari' },
            { type: 'image', src: '../../static/www/img/hackathons/global-archiact-jam/devpost_02.png', alt: 'Low Poly Safari' },
            { type: 'image', src: '../../static/www/img/hackathons/global-archiact-jam/devpost_03.jpg', alt: 'Low Poly Safari' },
            { type: 'image', src: '../../static/www/img/hackathons/global-archiact-jam/devpost_04.png', alt: 'Low Poly Safari' },
            { type: 'image', src: '../../static/www/img/hackathons/global-archiact-jam/devpost_05.png', alt: 'Low Poly Safari' },
            { type: 'image', src: '../../static/www/img/hackathons/global-archiact-jam/devpost_06.png', alt: 'Low Poly Safari' }
        ]
    },
    'makers-against-drought': {
        project: 'Wtr: Water Tracking Resource',
        description: 'Smart home plumbing using the Samsung Artik. A water monitoring and conservation system enabling users to track consumption and manually control shutoff valves.',
        duration: '',
        team: 'Solo',
        tech: ['Android', 'Arduino', 'Artik', 'HTML5', 'Java', 'JavaScript', 'PostgreSQL', 'Python'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/wtr-water-tracking-resource' }
        ],
        media: [
            { type: 'youtube', id: 'fK5ksaOk-Dw' },
            { type: 'image', src: '../../static/www/img/hackathons/makers-against-drought/devpost_01.png', alt: 'Wtr' },
            { type: 'image', src: '../../static/www/img/hackathons/makers-against-drought/devpost_02.png', alt: 'Wtr' },
            { type: 'image', src: '../../static/www/img/hackathons/makers-against-drought/devpost_03.png', alt: 'Wtr' }
        ]
    },
    'junction-asia_2016': {
        project: 'Salt and Pepper',
        description: 'Remote control of a Pepper robot via VR goggles from anywhere in the world for household tasks.',
        duration: '',
        team: '5 teammates',
        tech: ['Unity', 'Pepper', 'Leap Motion', 'Android', 'Oculus'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/salt-and-pepper-sl13nx' }
        ],
        media: [
            { type: 'youtube', id: 'afjs78h8fo0' },
            { type: 'image', src: '../../static/www/img/hackathons/junction-asia_2016/photo_01.jpg', alt: 'Salt and Pepper' }
        ]
    },
    'mlh_prime_2016': {
        project: 'Project Sluggers',
        description: 'A virtual reality mario baseball game.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['Unity', 'C#', 'Oculus DK2', 'Myo', 'Leap Motion'],
        awards: 'Top 10',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/project-sluggers' },
            { label: 'GitHub', url: 'https://github.com/Scub3d/Project-Sluggers' }
        ],
        media: [
            { type: 'youtube', id: 'OCI2aNPGFn4' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/devpost_01.jpg', alt: 'Project Sluggers' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/devpost_02.jpg', alt: 'Project Sluggers' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/photo_01.jpg', alt: 'MLH Prime 2016' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/photo_02.jpg', alt: 'MLH Prime 2016' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/photo_03.jpg', alt: 'MLH Prime 2016' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/photo_04.jpg', alt: 'MLH Prime 2016' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/photo_05.jpg', alt: 'MLH Prime 2016' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/photo_06.jpg', alt: 'MLH Prime 2016' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/photo_07.jpg', alt: 'MLH Prime 2016' },
            { type: 'image', src: '../../static/www/img/hackathons/mlh_prime_2016/photo_08.jpg', alt: 'MLH Prime 2016' }
        ]
    },
    'htn_2016': {
        project: 'Project Open Heart',
        description: 'VR open heart surgery with Alexa as a virtual nurse. Voice-controlled surgical tool retrieval with immersive VR simulation for surgical training.',
        duration: '36 hours',
        team: '2 teammates',
        tech: ['Unity', 'C#', 'Amazon Alexa', 'JavaScript', 'Node.js', 'Firebase', 'Oculus Rift', 'Leap Motion'],
        awards: 'Firebase API Prize, Top 12',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/project-open-heart' },
            { label: 'GitHub', url: 'https://github.com/AdilVirani/Project-Heart' }
        ],
        media: [
            { type: 'youtube', id: 'K31ZpTEOQCE' },
            { type: 'video', src: '../../static/www/img/hackathons/htn_2016/video_01.mp4', alt: 'Project Open Heart demo' },
            { type: 'image', src: '../../static/www/img/hackathons/htn_2016/devpost_01.png', alt: 'Project Open Heart' },
            { type: 'image', src: '../../static/www/img/hackathons/htn_2016/photo_01.jpg', alt: 'Project Open Heart' },
            { type: 'image', src: '../../static/www/img/hackathons/htn_2016/photo_02.jpg', alt: 'Project Open Heart' },
            { type: 'image', src: '../../static/www/img/hackathons/htn_2016/photo_03.jpg', alt: 'Project Open Heart' },
            { type: 'image', src: '../../static/www/img/hackathons/htn_2016/photo_04.jpg', alt: 'Project Open Heart' }
        ]
    },
    'mhacks8_2016': {
        project: 'Project Tennis',
        description: 'VR multiplayer tennis built atop Azure featuring the Amazon Alexa, with audience interaction and real-time feedback via accelerometer data.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['Unity', 'AWS Lambda', 'Amazon Alexa', 'Android', 'Myo'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/project-tennis' },
            { label: 'GitHub', url: 'https://github.com/Scub3d/Project-Tennis' }
        ],
        media: [
            { type: 'youtube', id: 'LsAxZgyd6Dg' },
            { type: 'image', src: '../../static/www/img/hackathons/mhacks8_2016/photo_01.jpg', alt: 'Project Tennis' }
        ]
    },
    'spartahack_2017': {
        project: 'Blendexa',
        description: 'A web server inside Blender that accepts RESTful requests to control it and retrieve data, with Alexa voice commands to access Blender documentation.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['Amazon Alexa', 'Blender', 'Node.js', 'Python', 'Tornado'],
        awards: 'Top 10, Most Technically Impressive',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/blendexa' }
        ],
        media: [
            { type: 'youtube', id: 'zeIrCWVi018' }
        ]
    },
    'mhacks9_2017': {
        project: 'Project Air',
        description: 'VR air traffic control simulator. Clear planes for landing/takeoff, manage holding patterns, and prevent collisions using voice commands via Alexa.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['Unity', 'Firebase', 'Amazon Alexa', 'HTC Vive'],
        awards: 'Best Hack for Air Traffic Control (C2)',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/project-air' }
        ],
        media: [
            { type: 'youtube', id: '8WyF8me9Sy0' }
        ]
    },
    'junction-tokyo_2017': {
        project: 'Project Vendio',
        description: 'Turn Pepper into your personal shopping helper. An AI-powered retail assistant using IBM Watson that provides personalized recommendations and inventory checks.',
        duration: '48 hours',
        team: '3 teammates',
        tech: ['Android', 'Bluemix', 'JavaScript', 'MongoDB', 'Pepper', 'Python'],
        awards: 'Robotics Track Winner, IBM Bluemix Winner',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/project-vendio' }
        ],
        media: [
            { type: 'youtube', id: 'g6eeZtE9ASw' },
            { type: 'image', src: '../../static/www/img/hackathons/junction-tokyo_2017/photo_01.jpg', alt: 'Project Vendio' },
            { type: 'image', src: '../../static/www/img/hackathons/junction-tokyo_2017/photo_02.jpg', alt: 'Project Vendio' },
            { type: 'image', src: '../../static/www/img/hackathons/junction-tokyo_2017/photo_03.jpg', alt: 'Project Vendio' },
            { type: 'image', src: '../../static/www/img/hackathons/junction-tokyo_2017/photo_04.jpg', alt: 'Project Vendio' }
        ]
    },
    'hack-cincy_2017': {
        project: 'Unwearable',
        description: 'An IoT LED salt rock lamp controlled via webserver that illuminates in morse code patterns based on messages sent through an Android app or webcam detection.',
        duration: '24 hours',
        team: '4 teammates',
        tech: ['Android', 'Cyclone', 'Java', 'OpenCV', 'Python', 'Raspberry Pi'],
        awards: 'Fashion Winner',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/unwearable' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/hack-cincy_2017/photo_01.jpg', alt: 'Unwearable' },
            { type: 'image', src: '../../static/www/img/hackathons/hack-cincy_2017/photo_02.jpg', alt: 'Unwearable' }
        ]
    },
    'htn_2017': {
        project: 'Deep Reality',
        description: 'View machine learning in VR while browsing a high class art gallery. Neural network training visualized through color-changing cubes, trained on Bob Ross paintings.',
        duration: '36 hours',
        team: '3 teammates',
        tech: ['Unity', 'C#', 'Firebase', 'Google Home', 'Python', 'PyTorch', 'HTC Vive'],
        awards: 'Google Winner',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/deep-reality' }
        ],
        media: [
            { type: 'youtube', id: 'B0t1KIPdys0' },
            { type: 'image', src: '../../static/www/img/hackathons/htn_2017/photo_01.jpg', alt: 'Deep Reality' },
            { type: 'image', src: '../../static/www/img/hackathons/htn_2017/photo_02.jpg', alt: 'Deep Reality' }
        ]
    },
    'mhacksx_2017': {
        project: 'Sticker Overflow',
        description: 'A website and Android app that allows you to manage your sticker collection. Recognize stickers via photos, browse hackathons, and explore a sticker database.',
        duration: '36 hours',
        team: 'Solo',
        tech: ['Android', 'Firebase', 'Firebase Cloud Functions', 'Firestore', 'Google Cloud', 'Node.js', 'Python', 'TensorFlow'],
        awards: 'Best Domain Name (Domain.com)',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/swagoverflow' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/mhacksx_2017/devpost_01.png', alt: 'Sticker Overflow' },
            { type: 'image', src: '../../static/www/img/hackathons/mhacksx_2017/devpost_02.png', alt: 'Sticker Overflow' },
            { type: 'image', src: '../../static/www/img/hackathons/mhacksx_2017/devpost_03.png', alt: 'Sticker Overflow' },
            { type: 'image', src: '../../static/www/img/hackathons/mhacksx_2017/devpost_04.png', alt: 'Sticker Overflow' }
        ]
    },
    'spartahack_2018': {
        project: 'VR Barista Trainer',
        description: 'Walks you through the training a Starbucks barista receives when they first start out. Reduces training waste and time by familiarizing employees with machinery in VR.',
        duration: '36 hours',
        team: '3 teammates',
        tech: ['Unity', 'C#', 'Maya'],
        awards: 'Best Business Hack, Best Sustainability (Dow), 2nd Place',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/vr-barista-trainer' }
        ],
        media: []
    },
    'hackcwru_2018': {
        project: 'VR Gloves',
        description: 'Finger and palm orientation tracking system in 3D space. Custom gloves for VR with a retro Donkey Kong game.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['Arduino', 'C', 'C#', 'Firebase', 'Unity'],
        awards: 'Runner Up, Best STEM Education for Women, Garverick Memorial Prize, Best Startup Pitch',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/vr-gloves' }
        ],
        media: []
    },
    'htn_2018': {
        project: 'Pokedex-AR',
        description: 'An AR Pokedex utilizing ARCore that identifies Pokemon from pictures and displays 3D models with stats and characteristics.',
        duration: '36 hours',
        team: '4 teammates',
        tech: ['Unity', 'ARCore', 'Firebase', 'C#', 'Python'],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/pokedex-ar' },
            { label: 'GitHub', url: 'https://github.com/Scub3d/Pokedex-AR' }
        ],
        media: [
            { type: 'youtube', id: 'XJ5Wf84uyf0' }
        ]
    },
    'grizzhacks-3': {
        project: '',
        description: '',
        duration: '',
        team: '',
        tech: [],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://grizzhacks3.devpost.com/' }
        ],
        media: []
    },
    'mhacks11_2018': {
        project: 'VR Piano',
        description: 'Learn, play, and explore piano in VR. Multiple gameplay modes including practice, learning, and a rhythm-game style challenge.',
        duration: '36 hours',
        team: '3 teammates',
        tech: ['Unity', 'C#', 'HTC Vive', 'Leap Motion'],
        awards: '2nd Place',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/vr-piano' }
        ],
        media: [
            { type: 'youtube', id: 'yEXqeT6hroA' },
            { type: 'image', src: '../../static/www/img/hackathons/mhacks11_2018/photo_01.jpg', alt: 'VR Piano' },
            { type: 'image', src: '../../static/www/img/hackathons/mhacks11_2018/photo_02.jpg', alt: 'VR Piano' }
        ]
    },
    'riot_games_hackathon': {
        project: 'League AR',
        description: 'Built at the 2018 Riot Games Hackathon at Riot HQ in Los Angeles over 3 days. The app allows users to view replays of professional LoL matches on their smartphones in augmented reality. Using the lolEsports, Tournament, and Timeline APIs, the app re-renders League of Legends matches in AR via Unity, interpolating champion positions from sporadically received frame data.',
        duration: '3 days',
        team: '4 teammates',
        tech: ['Unity', 'C#', 'ARCore', 'Riot Games API'],
        awards: '',
        quote: {
            text: 'The annual @RiotGamesAPI Hackathon wrapped up on Friday. Eleven teams of game designers and developers had 36 hours to create a product to educate League of Legends players. Check out the Instagram highlights for a look at the projects.',
            author: '@riotgames',
            url: 'https://twitter.com/riotgames/status/1062057793463627777'
        },
        links: [
            { label: 'Riot DevRel Blog', url: 'https://www.riotgames.com/en/DevRel/hackathon-2018' },
            { label: 'Riot Instagram Story', url: 'https://www.instagram.com/stories/highlights/17998515211004878/' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/riot_games_hackathon/photo_07.png', alt: 'League AR app screenshot - AR match replay with champion models' },
            {
                type: 'grid', items: [
                    { src: '../../static/www/video/league_ar_insta_1.mp4' },
                    { src: '../../static/www/video/league_ar_insta_2.mp4' },
                    { src: '../../static/www/video/league_ar_insta_3.mp4' },
                    { src: '../../static/www/video/league_ar_insta_4.mp4' }
                ], alt: 'League AR Instagram clips'
            },
            { type: 'video', src: '../../static/www/img/hackathons/riot_games_hackathon/video_01.mp4', alt: 'League AR demo video' },
            { type: 'image', src: '../../static/www/img/hackathons/riot_games_hackathon/photo_04.jpg', alt: 'AR app demo on projector during presentation' },
            { type: 'image', src: '../../static/www/img/hackathons/riot_games_hackathon/photo_03.jpg', alt: 'Team photo' },
            { type: 'image', src: '../../static/www/img/hackathons/riot_games_hackathon/photo_01.jpg', alt: 'Welcome to the Riot Games Hackathon Science Fair' },
            { type: 'image', src: '../../static/www/img/hackathons/riot_games_hackathon/photo_02.jpg', alt: 'Hacking room at Riot HQ' },
            { type: 'image', src: '../../static/www/img/hackathons/riot_games_hackathon/photo_05.jpg', alt: '2018 Riot Games Hackathon group photo' },
            { type: 'image', src: '../../static/www/img/hackathons/riot_games_hackathon/photo_06.jpg', alt: 'At the Riot Games sign' }
        ]
    },
    'spartahack_v_2019': {
        project: 'Dungeons and Dragons XR',
        description: 'Dungeons and Dragons in mixed reality. Play D&D with friends in a virtual world viewable in VR and AR, with enhanced dungeon master controls.',
        duration: '36 hours',
        team: '3 teammates',
        tech: ['Unity', 'C#', 'ARCore', 'Blender', 'Firebase', 'Node.js', 'Python', 'Vue'],
        awards: '2nd Place',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/d-d-xr' }
        ],
        media: []
    },
    'riot_api_challenge_2019': {
        project: 'League Voice',
        description: 'Voice-controlled League of Legends champion select assistant powered by Google Home. Manage your champion select entirely with voice commands using speech recognition and the Riot Games API.',
        duration: '5 weeks',
        team: '2 teammates',
        tech: ['Kotlin', 'Riot Games API', 'Google Home'],
        awards: '',
        links: [
            { label: 'Riot DevRel Recap', url: 'https://www.riotgames.com/en/DevRel/api-challenge-recap-winter-2019' },
            { label: 'GitHub', url: 'https://github.com/supergrecko/LeagueVoice' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/riot_api_challenge_2019/splash.png', alt: 'League Voice application' }
        ]
    },
    'brickhack_v_2019': {
        project: 'Babel AR',
        description: 'An AR app for Vuzix glasses that detects sign language and displays translations, plus live speech translation between glasses wearers.',
        duration: '24 hours',
        team: '4 teammates',
        tech: ['Android Studio', 'Google Compute Engine', 'Google Translate API', 'Python', 'TensorFlow'],
        awards: 'Best Use of 5G in Immersive Media',
        links: [
            { label: 'Devpost', url: 'https://devpost.com/software/babel-ar' }
        ],
        media: [
            { type: 'youtube', id: 'k-7wxQpFYcI' },
            { type: 'image', src: '../../static/www/img/hackathons/brickhack_v_2019/photo_01.jpg', alt: 'Babel AR' },
            { type: 'image', src: '../../static/www/img/hackathons/brickhack_v_2019/photo_02.jpg', alt: 'Babel AR' }
        ]
    },
    'grizzhacks-4': {
        project: '',
        description: '',
        duration: '',
        team: '',
        tech: [],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://grizzhacks-4.devpost.com/' }
        ],
        media: [
            { type: 'image', src: '../../static/www/img/hackathons/grizzhacks-4/photo_01.jpg', alt: 'GrizzHacks 4' }
        ]
    },
    'hack-quarantine-2020': {
        project: '',
        description: '',
        duration: '',
        team: '',
        tech: [],
        awards: '',
        links: [
            { label: 'Devpost', url: 'https://hackquarantine.devpost.com/' }
        ],
        media: []
    }
};
