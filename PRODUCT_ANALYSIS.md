# Iftar Coordinator — Product Analysis & Strategy

*February 2026 | For solo developer*

---

## 1. Jobs To Be Done (JTBD)

### Before Ramadan (1-2 weeks prior)
| Job | Current Solution | Our Opportunity |
|-----|-----------------|-----------------|
| Know when Ramadan starts | Google, muftyat.kz | Countdown + prep checklist in app |
| Plan meal prep for suhoor/iftar | Notes, memory | Meal planning templates |
| Coordinate who hosts iftars which days | WhatsApp group chaos | **Core product — event calendar** |
| Set spiritual goals (Quran khatm, charity) | Paper/mental | Ramadan goals tracker |
| Stock up on groceries | Experience | Shareable grocery lists |

### Daily During Ramadan
| Job | Current Solution | Our Opportunity |
|-----|-----------------|-----------------|
| Wake up for suhoor | Phone alarm | Suhoor alarm with dua + time remaining |
| Know exact iftar time today | Sajda, muftyat.kz | **Already have this** — prayer times |
| Track fasting days (30/30) | Mental count | Visual fasting streak tracker |
| Find where to break fast tonight | Friends, social media | **Core product** — today's iftar events |
| Decide what to cook/bring | WhatsApp coordination | Potluck coordinator in events |
| Read daily Quran portion | Sajda, Muslim Pro | Juz tracker with group accountability |
| Make specific Ramadan duas | Google, books | Dua cards (Arabic + Kazakh + Russian) |
| Give charity (sadaqa/zakat) | Bank transfer | Charity tracker (personal log) |
| Find tarawih prayer location | Word of mouth | Mosque directory with tarawih times |

### Social Jobs
| Job | Current Solution | Our Opportunity |
|-----|-----------------|-----------------|
| Invite friends to iftar | Individual messages | **Core product — shareable invites** |
| RSVP to invitations | Text reply | **Core product — RSVP system** |
| Know who's bringing what | Group chat mess | Potluck sign-up list |
| Share iftar photos/moments | Instagram stories | Iftar feed within events |
| Coordinate large community iftars | Mosque announcements | Public event listings |
| Find iftars when alone/traveling | No good solution | **Open iftar discovery** |

### Spiritual Jobs
| Job | Current Solution | Our Opportunity |
|-----|-----------------|-----------------|
| Read Quran daily | Sajda, physical Quran | Light integration (juz tracker only) |
| Learn iftar/suhoor duas | Google | Built-in dua cards |
| Track dhikr | Sajda, beads | Out of scope (Sajda does this well) |
| Calculate zakat | Calculators online | Simple zakat calculator |

### After Ramadan
| Job | Current Solution | Our Opportunity |
|-----|-----------------|-----------------|
| Coordinate Eid celebration | WhatsApp | Eid event planning |
| Track 6 days of Shawwal fasting | Memory | Fasting tracker continues |
| Monday/Thursday voluntary fasting | Nothing | Year-round fasting companion |
| White days fasting (13-15th) | Nothing | Hijri calendar reminders |

---

## 2. Competitor Analysis

### Sajda (sajda.com) — Main Competitor in KZ
- **Users:** 4M+ globally, strong in KZ/Central Asia
- **Features:** Prayer times, Quran (30+ translations), Qibla, Adhan alerts, dhikr counter, Apple Watch, widgets, live Makkah stream
- **Languages:** Kazakh, Russian, English + 8 more
- **Strengths:** Beautiful UI, ad-free since 2012, 4.9★ rating, deep spiritual features
- **Weaknesses:** **No social features, no event coordination, no iftar planning, no community**
- **Our angle:** Sajda is personal worship. We are social coordination. **Complementary, not competitive.**

### Muslim Pro
- **Users:** 150M+ downloads
- **Features:** Prayer times, Quran, Qibla, halal food finder, Islamic calendar, duas
- **Strengths:** Massive user base, comprehensive
- **Weaknesses:** Ad-heavy (free), no Kazakhstan-specific data, no social/event features, no Kazakh language
- **Our angle:** Local (KZ prayer times from muftyat.kz), social, Telegram-native

### WhatsApp/Telegram Groups (Informal Competitor)
- **How it works:** Family/friend groups coordinate iftars via messages
- **Strengths:** Everyone already uses it, zero friction
- **Weaknesses:** Chaotic, no calendar view, can't RSVP properly, info gets buried, no prayer times integration
- **Our angle:** We ARE in Telegram. We replace the chaos with structure while staying in the same platform.

### No Direct Competitors
**Nobody does iftar coordination as a product.** The social/event layer for Ramadan is a completely unserved niche. Every Muslim app focuses on individual worship. The coordination problem is solved by messy group chats.

---

## 3. Feature Ideas (Prioritized)

### 🔴 Must-Have (Build Now)

| Feature | Description | Effort | Impact | Priority |
|---------|-------------|--------|--------|----------|
| **Fasting day tracker** | Visual progress bar: Day 14/30. Tap to mark days fasted. Simple streak. | S | 5 | P0 |
| **Suhoor/Iftar reminders via bot** | Bot sends notification 30min before suhoor end, 10min before iftar. Configurable. | S | 5 | P0 |
| **Dua cards** | Iftar dua + suhoor dua in Arabic with Kazakh and Russian transliteration/translation. Show at relevant times. | S | 4 | P0 |
| **Shareable Ramadan calendar card** | Generate a beautiful image with prayer times for user's city for the whole month. Shareable to chats. | M | 5 | P0 |
| **Potluck coordinator** | Within iftar events: list of items needed, people claim what they'll bring. | S | 4 | P1 |

### 🟡 Should-Have (Build During Ramadan)

| Feature | Description | Effort | Impact | Priority |
|---------|-------------|--------|--------|----------|
| **Today's iftar widget** | When user opens app: "Tonight's iftar: [event] at [time] with [N people]. You're bringing: [item]" | S | 5 | P1 |
| **Open/public iftars** | Community iftars anyone can join. Mosques, restaurants, community centers can list. | M | 4 | P1 |
| **Iftar venue suggestions** | Directory of restaurants offering iftar menus in KZ cities. Crowdsourced. | M | 3 | P1 |
| **Daily engagement message** | Bot sends morning message: "Day 14 of Ramadan. Suhoor was at 5:23. Iftar at 18:45. You have 1 iftar tonight. Today's dua: ..." | S | 5 | P1 |
| **Kazakh language** | Full app localization in Kazakh (currently Russian?) | M | 4 | P1 |
| **Ramadan goals** | Set goals: "Read full Quran", "Give charity 30 days", "Attend tarawih 20 days". Track progress. | M | 3 | P2 |

### 🟢 Nice-to-Have (Post-Ramadan or Next Year)

| Feature | Description | Effort | Impact | Priority |
|---------|-------------|--------|--------|----------|
| **Quran juz tracker** | Track daily Quran reading. Group accountability: "Your group has read 450/900 juz together" | M | 3 | P2 |
| **Charity tracker** | Log daily sadaqa amounts. "You've given ₸45,000 this Ramadan" | S | 2 | P2 |
| **Mosque directory** | Map of mosques with tarawih times, parking, capacity | L | 3 | P3 |
| **Year-round fasting tracker** | Monday/Thursday, Shawwal 6, white days, Arafah, Ashura | M | 3 | P3 |
| **Eid event planner** | Same event system for Eid gatherings | S | 3 | P2 |
| **Recipe sharing** | Iftar recipes within events. "Beshbarmak for 10 people" | M | 2 | P3 |
| **Iftar cost splitter** | Split costs for group iftars | S | 2 | P3 |
| **Ramadan leaderboard** | Gamification: streaks, consistency, community impact | M | 3 | P3 |

---

## 4. Viral Growth Strategy

### Natural Viral Loop (Already Built-In!)
```
User creates iftar event
  → Invites 5-10 friends via bot
    → Friends open miniapp to RSVP
      → Friends see calendar, prayer times
        → Friends create their own events
          → They invite THEIR friends
            → 🔄 Repeat
```

**This is your core growth engine.** Every iftar invitation is a user acquisition event. Each event invites 5-15 people. If 20% convert to creators, you get exponential growth.

### Amplifiers

1. **Shareable Ramadan Calendar Cards**
   - Generate beautiful city-specific prayer time images
   - Users share to family WhatsApp groups, Instagram stories
   - Branded with app name/link
   - **Effort: S | Viral potential: HIGH**

2. **"X people fasting today in Almaty" counter**
   - Social proof on the home screen
   - "127 iftars happening tonight in Kazakhstan"
   - Shareable stat cards
   - **Effort: S | Viral potential: MEDIUM**

3. **Iftar invitation as a beautiful card**
   - Instead of plain text, bot sends a styled invitation card
   - "You're invited to iftar! 🌙 March 15 at 18:45, Aidyn's place. 7 people attending."
   - Recipients want to use the same tool
   - **Effort: M | Viral potential: HIGH**

4. **Day-of-Ramadan Stories**
   - "I've fasted 20/30 days this Ramadan 🌙" — shareable to Instagram/Telegram
   - Progress badge images
   - **Effort: S | Viral potential: MEDIUM**

5. **Community Iftar Board**
   - Public iftars visible to all users in a city
   - Mosques and community orgs post open iftars
   - Creates network effect: more events → more users → more events
   - **Effort: M | Viral potential: HIGH**

### Pre-Ramadan Launch Strategy
1. **T-14 days:** Release Ramadan countdown + calendar generator
2. **T-7 days:** "Plan your first iftar" push — get hosts to create events early
3. **Day 1:** Daily bot messages begin, fasting tracker goes live
4. **Week 1:** Iterate fast on feedback, polish invitation flow
5. **Day 15:** Mid-Ramadan push — "Share your progress" cards
6. **Day 27:** Laylatul Qadr special content
7. **Day 30:** Eid event planner, "Your Ramadan Recap" summary

---

## 5. Recommended MVP+ Roadmap

### Phase 1: "Ramadan Daily Companion" (1-2 weeks, before Ramadan)
*Goal: Make users open the app EVERY DAY, not just for events*

- [ ] Fasting day tracker (tap to mark, streak visual)
- [ ] Daily bot message (day count, prayer times, tonight's iftar, dua)
- [ ] Suhoor/iftar time reminders via bot
- [ ] Iftar/suhoor dua cards (Arabic + Kazakh + Russian)
- [ ] Shareable Ramadan calendar card for user's city
- [ ] Beautiful iftar invitation cards (not plain text)
- [ ] "Today" home screen: what's happening tonight

### Phase 2: "Social Ramadan" (during first week of Ramadan)
*Goal: Increase viral coefficient*

- [ ] Potluck coordinator within events
- [ ] Public/open iftar listings
- [ ] "X fasting today" community counter
- [ ] Shareable fasting progress cards
- [ ] Kazakh language support

### Phase 3: "Ramadan Hub" (mid-Ramadan)
*Goal: Deepen engagement*

- [ ] Ramadan goals tracker
- [ ] Iftar venue directory (crowdsourced)
- [ ] Quran juz tracker (simple)
- [ ] Eid event planning

### Phase 4: "Year-Round" (post-Ramadan)
*Goal: Retain users beyond Ramadan*

- [ ] Shawwal 6 days fasting tracker
- [ ] Monday/Thursday fasting reminders
- [ ] White days notifications
- [ ] General Islamic event coordination

---

## 6. Sajda.kz — Complement, Don't Compete

### What Sajda Does (That We Should NOT Build)
- ❌ Prayer times engine (use muftyat.kz API, keep it simple)
- ❌ Full Quran reader (Sajda has 30+ translations, mushaf mode, tajweed)
- ❌ Qibla compass
- ❌ Dhikr counter
- ❌ Adhan sounds
- ❌ Apple Watch / widgets

### What Sajda Doesn't Do (Our Opportunity)
- ✅ **Social anything** — no events, no invitations, no groups
- ✅ **Iftar coordination** — completely absent
- ✅ **Fasting tracker** — they don't have one
- ✅ **Community features** — no public events, no social proof
- ✅ **Telegram-native** — they're a native app, we're zero-install
- ✅ **Potluck/meal coordination** — doesn't exist anywhere
- ✅ **Localized content** — Kazakh-specific duas, cultural elements

### Strategic Position
```
Sajda = Personal worship (prayer, Quran, dhikr)
Us    = Social Ramadan (coordination, community, accountability)
```

We should **link to Sajda** for Quran/dhikr features rather than building inferior versions. They might even cross-promote us. Consider reaching out.

---

## 7. Key Insights

### Why Telegram Miniapp is the Right Platform
1. **Zero install friction** — tap a link, you're in
2. **Built-in notifications** — bot messages are push notifications
3. **Built-in sharing** — forward invitations to any chat
4. **Telegram is dominant in Kazakhstan** — 90%+ of target users have it
5. **Social graph already exists** — users' contacts are there

### The One Metric That Matters
**Daily Active Users during Ramadan.** Not downloads, not signups. How many people open the app every single day of the 30 days.

To maximize this:
- Morning bot message (suhoor time + day count + dua)
- Evening iftar reminder
- Fasting tracker requires daily tap
- "Tonight's iftar" pulls them back to check event details

### What Makes This Win
1. **Network effects** — each event brings 5-15 new users
2. **Daily habit** — fasting tracker + reminders create daily opens
3. **Platform advantage** — Telegram-native = zero friction
4. **Unserved niche** — nobody does social Ramadan coordination
5. **Cultural fit** — built for Kazakhstan, Kazakh/Russian, muftyat.kz data

### Biggest Risk
**Seasonality.** Ramadan is 30 days/year. Without year-round value, you rebuild your user base annually. The fasting tracker (Monday/Thursday, Shawwal, etc.) is the bridge. But honestly, being the BEST Ramadan app and accepting seasonality is a valid strategy — many businesses are seasonal.

---

## 8. Quick Wins for This Week

If Ramadan is approaching and you need maximum impact with minimum effort:

1. **🔥 Daily bot message** (2-3 hours) — Morning message with day count, times, dua. This alone drives daily engagement.
2. **🔥 Fasting tracker** (3-4 hours) — Simple 30-circle grid. Tap to mark. Shows streak.
3. **🔥 Dua cards** (1-2 hours) — Suhoor and iftar duas. Arabic + transliteration + Kazakh/Russian translation.
4. **🔥 Calendar card generator** (3-4 hours) — Shareable image with monthly prayer times. Biggest viral feature.
5. **🔥 Pretty invitation cards** (2-3 hours) — Style the bot's invitation message as a card with event details.

Total: ~15 hours for transformative impact on daily usage and viral growth.
