import '../../models/channel.dart';

/// Mock data preserved from Phase 1 for reference and offline fallback.
///
/// Not imported by any production provider or screen in Phase 5.
/// All live data now comes from the backend API.
class MockData {
  static const String testStreamUrl =
      'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

  static const List<Channel> channels = [
    // Football
    Channel(
      id: 'fb_sky_prem',
      name: 'Sky Sports Premier League',
      logo: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=300&auto=format&fit=crop&q=60',
      category: 'Football',
      isLive: true,
      currentShow: 'Arsenal vs Chelsea - Live Match',
      viewCount: 2400000,
    ),
    Channel(
      id: 'fb_laliga_tv',
      name: 'LaLiga TV HD',
      logo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=300&auto=format&fit=crop&q=60',
      category: 'Football',
      isLive: true,
      currentShow: 'El Clásico: Real Madrid vs Barcelona',
      viewCount: 4800000,
    ),
    Channel(
      id: 'fb_espn_fc',
      name: 'ESPN FC',
      logo: 'https://images.unsplash.com/photo-1575361204480-aadea2d1d7a3?w=300&auto=format&fit=crop&q=60',
      category: 'Football',
      isLive: false,
      currentShow: 'Transfer Talk: Summer Window',
      viewCount: 45000,
    ),
    Channel(
      id: 'fb_bt_sport',
      name: 'TNT Sports 1 Football',
      logo: 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?w=300&auto=format&fit=crop&q=60',
      category: 'Football',
      isLive: true,
      currentShow: 'UEFA Champions League: Bayern vs PSG',
      viewCount: 1200000,
    ),
    Channel(
      id: 'fb_be_in_1',
      name: 'beIN SPORTS 1 HD',
      logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=300&auto=format&fit=crop&q=60',
      category: 'Football',
      isLive: false,
      currentShow: 'Ligue 1 Review Show',
      viewCount: 12000,
    ),

    // Cricket
    Channel(
      id: 'cr_star_1',
      name: 'Star Sports 1 Cricket HD',
      logo: 'https://images.unsplash.com/photo-1624194685917-a1c13d09a20c?w=300&auto=format&fit=crop&q=60',
      category: 'Cricket',
      isLive: true,
      currentShow: 'IPL: Mumbai Indians vs Chennai Super Kings',
      viewCount: 8200000,
    ),
    Channel(
      id: 'cr_willow',
      name: 'Willow TV Live',
      logo: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=300&auto=format&fit=crop&q=60',
      category: 'Cricket',
      isLive: true,
      currentShow: 'T20 World Cup: India vs Pakistan',
      viewCount: 12500000,
    ),
    Channel(
      id: 'cr_sky_crick',
      name: 'Sky Sports Cricket HD',
      logo: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=300&auto=format&fit=crop&q=60',
      category: 'Cricket',
      isLive: false,
      currentShow: 'The Ashes: Historic Highlights',
      viewCount: 180000,
    ),
    Channel(
      id: 'cr_fox_crick',
      name: 'Fox Cricket HD',
      logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=300&auto=format&fit=crop&q=60',
      category: 'Cricket',
      isLive: true,
      currentShow: 'Australia vs South Africa - 2nd ODI',
      viewCount: 550000,
    ),

    // Basketball
    Channel(
      id: 'bb_nba_tv',
      name: 'NBA TV Live',
      logo: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a27?w=300&auto=format&fit=crop&q=60',
      category: 'Basketball',
      isLive: true,
      currentShow: 'NBA Finals: Lakers vs Celtics - Game 7',
      viewCount: 3100000,
    ),
    Channel(
      id: 'bb_espn_2',
      name: 'ESPN Basketball HD',
      logo: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300&auto=format&fit=crop&q=60',
      category: 'Basketball',
      isLive: true,
      currentShow: 'NCAA March Madness: Duke vs Kentucky',
      viewCount: 980000,
    ),
    Channel(
      id: 'bb_tnt_sports',
      name: 'TNT Sports Basketball',
      logo: 'https://images.unsplash.com/photo-1505666287802-931dc83948e9?w=300&auto=format&fit=crop&q=60',
      category: 'Basketball',
      isLive: false,
      currentShow: 'Inside the NBA (Post-game Analysis)',
      viewCount: 320000,
    ),
    Channel(
      id: 'bb_euro_tv',
      name: 'EuroLeague TV HD',
      logo: 'https://images.unsplash.com/photo-1519766304817-4f37bda74a27?w=300&auto=format&fit=crop&q=60',
      category: 'Basketball',
      isLive: false,
      currentShow: 'Euroleague Top 10 Dunks of the Week',
      viewCount: 45000,
    ),

    // Tennis
    Channel(
      id: 'tn_tennis_ch',
      name: 'The Tennis Channel',
      logo: 'https://images.unsplash.com/photo-1622279457486-62dcc4a4b1de?w=300&auto=format&fit=crop&q=60',
      category: 'Tennis',
      isLive: true,
      currentShow: 'French Open: Djokovic vs Nadal',
      viewCount: 1800000,
    ),
    Channel(
      id: 'tn_wimb_live',
      name: 'Wimbledon Live HD',
      logo: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=300&auto=format&fit=crop&q=60',
      category: 'Tennis',
      isLive: true,
      currentShow: 'Wimbledon Men\'s Singles Final',
      viewCount: 4200000,
    ),
    Channel(
      id: 'tn_us_open',
      name: 'US Open TV',
      logo: 'https://images.unsplash.com/photo-1560012057-4372e14c5085?w=300&auto=format&fit=crop&q=60',
      category: 'Tennis',
      isLive: false,
      currentShow: 'Greatest US Open Finals Remastered',
      viewCount: 25000,
    ),
    Channel(
      id: 'tn_atp_tour',
      name: 'ATP Tour Live',
      logo: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=300&auto=format&fit=crop&q=60',
      category: 'Tennis',
      isLive: true,
      currentShow: 'ATP 1000: Rome Masters - Semis',
      viewCount: 450000,
    ),

    // UFC
    Channel(
      id: 'ufc_fight_pass',
      name: 'UFC Fight Pass HD',
      logo: 'https://images.unsplash.com/photo-1517438476312-10d79c07750d?w=300&auto=format&fit=crop&q=60',
      category: 'UFC / MMA',
      isLive: true,
      currentShow: 'UFC 310 Prelims Live',
      viewCount: 1500000,
    ),
    Channel(
      id: 'ufc_espn_ppv',
      name: 'ESPN+ UFC PPV Channel',
      logo: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=300&auto=format&fit=crop&q=60',
      category: 'UFC / MMA',
      isLive: true,
      currentShow: 'UFC Title Fight: McGregor vs Makhachev',
      viewCount: 6700000,
    ),
    Channel(
      id: 'ufc_dazn_fight',
      name: 'DAZN Fight Night',
      logo: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=300&auto=format&fit=crop&q=60',
      category: 'UFC / MMA',
      isLive: false,
      currentShow: 'MMA Classics: Khabib vs McGregor Replay',
      viewCount: 85000,
    ),
    Channel(
      id: 'ufc_main_event',
      name: 'Main Event UFC HD',
      logo: 'https://images.unsplash.com/photo-1550256213-718d7d4b64be?w=300&auto=format&fit=crop&q=60',
      category: 'UFC / MMA',
      isLive: false,
      currentShow: 'UFC Countdown: Jones vs Miocic',
      viewCount: 110000,
    ),
  ];
}
