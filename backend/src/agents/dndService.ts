export interface DiceRoll {
  dice: string; // e.g., "d20", "2d6+3"
  rolls: number[];
  modifiers: number;
  total: number;
  description: string;
}

export interface Character {
  name: string;
  race: string;
  class: string;
  level: number;
  stats: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };
  hitPoints: number;
  armorClass: number;
  equipment: string[];
  trait: string;
  background: string;
}

export interface Encounter {
  type: 'combat' | 'roleplay';
  title: string;
  description: string;
  setting: string;
  options: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  enemies?: Enemy[];
}

export interface Enemy {
  name: string;
  hitPoints: number;
  armorClass: number;
  attackBonus: number;
  damage: string;
  description: string;
}

export class DNDService {
  // Dice rolling system
  rollDice(diceString: string, description: string = ''): DiceRoll {
    // Parse dice string like "d20", "2d6+3", "1d8-1"
    const match = diceString.toLowerCase().match(/^(\d*)d(\d+)([+-]\d+)?$/);
    
    if (!match) {
      throw new Error(`Invalid dice format: ${diceString}`);
    }

    const numDice = parseInt(match[1] || '1');
    const dieSize = parseInt(match[2]);
    const modifier = parseInt(match[3] || '0');

    const rolls: number[] = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * dieSize) + 1);
    }

    const rollTotal = rolls.reduce((sum, roll) => sum + roll, 0);
    const total = rollTotal + modifier;

    return {
      dice: diceString,
      rolls,
      modifiers: modifier,
      total,
      description: description || `Rolling ${diceString}`
    };
  }

  // Roll with advantage (roll twice, take higher)
  rollWithAdvantage(diceString: string, description: string = ''): DiceRoll {
    const roll1 = this.rollDice(diceString, description);
    const roll2 = this.rollDice(diceString, description);
    
    const betterRoll = roll1.total >= roll2.total ? roll1 : roll2;
    
    return {
      ...betterRoll,
      description: `${description} (ADVANTAGE: rolled ${roll1.total} and ${roll2.total}, using ${betterRoll.total})`
    };
  }

  // Roll with disadvantage (roll twice, take lower)
  rollWithDisadvantage(diceString: string, description: string = ''): DiceRoll {
    const roll1 = this.rollDice(diceString, description);
    const roll2 = this.rollDice(diceString, description);
    
    const worseRoll = roll1.total <= roll2.total ? roll1 : roll2;
    
    return {
      ...worseRoll,
      description: `${description} (DISADVANTAGE: rolled ${roll1.total} and ${roll2.total}, using ${worseRoll.total})`
    };
  }

  // Generate random character
  generateCharacter(): Character {
    const races = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Tiefling', 'Half-Elf', 'Gnome', 'Half-Orc'];
    const classes = ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger', 'Barbarian', 'Paladin', 'Warlock', 'Bard', 'Sorcerer'];
    
    const firstNames = [
      'Aerdrie', 'Ahvak', 'Aramil', 'Berris', 'Citam', 'Enna', 'Galinndan', 'Hadarai', 'Immeral', 'Ivellios',
      'Korfel', 'Lamlis', 'Laucian', 'Mindartis', 'Naal', 'Nutae', 'Paelinn', 'Peren', 'Quarion', 'Riardon',
      'Silvyr', 'Suhnab', 'Thamior', 'Theren', 'Theriatis', 'Thervan', 'Uthemar', 'Vanuath', 'Varis', 'Dayereth',
      'Eiravel', 'Enna', 'Galinndan', 'Hadarai', 'Halimath', 'Helder', 'Hrolgar', 'Ivellios', 'Korfel', 'Lamlis'
    ];

    const lastNames = [
      'Amakir', 'Amrithar', 'Cacerien', 'Drannor', 'Eltaor', 'Galinndan', 'Hadarai', 'Immeral', 'Ivellios', 'Korfel',
      'Moonwhisper', 'Helder', 'Hornraven', 'Lackman', 'Stormwind', 'Windrivver', 'Helder', 'Amakir', 'Amrithar',
      'Silverleaf', 'Goldmane', 'Ironforge', 'Stoutheart', 'Lightbringer', 'Shadowstep', 'Flameheart', 'Frostborn'
    ];

    const race = races[Math.floor(Math.random() * races.length)];
    const characterClass = classes[Math.floor(Math.random() * classes.length)];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    // Generate stats using 4d6 drop lowest method
    const generateStat = (): number => {
      const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
      rolls.sort((a, b) => b - a);
      return rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0);
    };

    const stats = {
      STR: generateStat(),
      DEX: generateStat(),
      CON: generateStat(),
      INT: generateStat(),
      WIS: generateStat(),
      CHA: generateStat()
    };

    // Calculate derived stats
    const conModifier = Math.floor((stats.CON - 10) / 2);
    const hitPoints = 10 + conModifier + Math.floor(Math.random() * 8) + 1; // Base + CON + class hit die
    const dexModifier = Math.floor((stats.DEX - 10) / 2);
    const armorClass = 10 + dexModifier + (characterClass === 'Fighter' || characterClass === 'Paladin' ? 6 : 2); // Base + DEX + armor

    // Equipment based on class
    const equipmentMap: Record<string, string[]> = {
      'Fighter': ['Sword', 'Shield', 'Chain Mail', 'Javelin', 'Explorer\'s Pack'],
      'Wizard': ['Quarterstaff', 'Spellbook', 'Component Pouch', 'Dagger', 'Scholar\'s Pack'],
      'Rogue': ['Shortsword', 'Shortbow', 'Thieves\' Tools', 'Leather Armor', 'Burglar\'s Pack'],
      'Cleric': ['Mace', 'Scale Mail', 'Shield', 'Holy Symbol', 'Priest\'s Pack'],
      'Ranger': ['Longbow', 'Shortsword', 'Leather Armor', 'Explorer\'s Pack', 'Quiver of Arrows'],
      'Barbarian': ['Greataxe', 'Handaxe', 'Explorer\'s Pack', 'Leather Armor', 'Javelin'],
      'Paladin': ['Longsword', 'Shield', 'Chain Mail', 'Holy Symbol', 'Explorer\'s Pack'],
      'Warlock': ['Light Crossbow', 'Component Pouch', 'Leather Armor', 'Dagger', 'Scholar\'s Pack'],
      'Bard': ['Rapier', 'Entertainer\'s Pack', 'Leather Armor', 'Dagger', 'Lute'],
      'Sorcerer': ['Light Crossbow', 'Component Pouch', 'Dagger', 'Explorer\'s Pack', 'Leather Armor']
    };

    const equipment = equipmentMap[characterClass] || ['Basic Equipment'];

    // Generate trait
    const traits = [
      'Has an uncanny ability to communicate with animals',
      'Never forgets a face or a favor',
      'Collects small trinkets from every place visited',
      'Always speaks in whispers when nervous',
      'Has vivid dreams that sometimes come true',
      'Can\'t resist a good riddle or puzzle',
      'Always helps those in need, even at personal cost',
      'Has a pet familiar that follows them everywhere',
      'Remembers every insult ever directed at them',
      'Can sense when someone is lying',
      'Always carries lucky dice',
      'Has a distinctive laugh that can be heard from far away',
      'Never removes a particular piece of jewelry',
      'Sketches interesting people they meet',
      'Has an irrational fear of a common creature',
      'Always tries to see the good in people',
      'Compulsively counts things',
      'Has a scar with an interesting story',
      'Can\'t sleep without a particular ritual',
      'Always bets on games of chance'
    ];

    const backgrounds = [
      'Former city guard who left to seek adventure',
      'Raised by monks in a remote monastery',
      'Escaped from slavery and now fights for freedom',
      'Noble who gave up wealth for a life of adventure',
      'Wandering merchant with stories from many lands',
      'Former soldier seeking redemption',
      'Orphan raised by thieves in the city streets',
      'Scholar who left the library to experience the world',
      'Farmer whose village was destroyed by monsters',
      'Entertainer who performed in taverns across the realm',
      'Hermit who lived alone in the wilderness',
      'Sailor who survived a terrible shipwreck',
      'Apprentice wizard who left their master',
      'Temple acolyte seeking their deity\'s will',
      'Criminal trying to make amends for past deeds',
      'Folk hero who saved their hometown',
      'Guild artisan with masterful crafting skills',
      'Courtier familiar with noble intrigue',
      'Outlander from the far reaches of civilization',
      'Sage with extensive knowledge of ancient lore'
    ];

    return {
      name: `${firstName} ${lastName}`,
      race,
      class: characterClass,
      level: 1,
      stats,
      hitPoints,
      armorClass,
      equipment,
      trait: traits[Math.floor(Math.random() * traits.length)],
      background: backgrounds[Math.floor(Math.random() * backgrounds.length)]
    };
  }

  // Generate random encounter
  generateEncounter(type?: 'combat' | 'roleplay'): Encounter {
    const encounterType = type || (Math.random() < 0.5 ? 'combat' : 'roleplay');

    if (encounterType === 'combat') {
      return this.generateCombatEncounter();
    } else {
      return this.generateRoleplayEncounter();
    }
  }

  private generateCombatEncounter(): Encounter {
    const combatEncounters = [
      {
        title: 'Goblin Ambush',
        description: 'A group of goblins jumps out from behind the trees, wielding crude weapons and snarling threats!',
        setting: 'Forest path',
        enemies: [
          { name: 'Goblin Scout', hitPoints: 7, armorClass: 15, attackBonus: 4, damage: '1d6+2', description: 'Small, green-skinned humanoid with yellow eyes' },
          { name: 'Goblin Warrior', hitPoints: 9, armorClass: 15, attackBonus: 4, damage: '1d6+2', description: 'Slightly larger goblin with a rusty scimitar' }
        ],
        options: ['Attack with weapon', 'Try to intimidate them', 'Attempt to flee', 'Cast a spell'],
        difficulty: 'easy' as const
      },
      {
        title: 'Skeletal Guards',
        description: 'Ancient skeletons in rusted armor rise from their eternal rest, eye sockets glowing with unholy light.',
        setting: 'Ancient tomb',
        enemies: [
          { name: 'Skeleton Warrior', hitPoints: 13, armorClass: 13, attackBonus: 4, damage: '1d6+2', description: 'Animated skeleton wielding a worn shortsword' },
          { name: 'Skeleton Archer', hitPoints: 13, armorClass: 13, attackBonus: 4, damage: '1d6+2', description: 'Skeleton with a shortbow and quiver of arrows' }
        ],
        options: ['Charge into melee', 'Keep your distance and use ranged attacks', 'Try to turn undead', 'Look for another way around'],
        difficulty: 'medium' as const
      },
      {
        title: 'Dire Wolf Pack',
        description: 'A pack of massive wolves with glowing red eyes emerges from the undergrowth, hungry and aggressive.',
        setting: 'Dark forest clearing',
        enemies: [
          { name: 'Dire Wolf Alpha', hitPoints: 37, armorClass: 14, attackBonus: 5, damage: '2d6+3', description: 'Enormous wolf with silver-streaked fur and intelligent eyes' },
          { name: 'Dire Wolf', hitPoints: 37, armorClass: 14, attackBonus: 5, damage: '2d6+3', description: 'Large, muscular wolf with sharp fangs' }
        ],
        options: ['Stand your ground and fight', 'Try to back away slowly', 'Make loud noises to scare them', 'Climb a nearby tree'],
        difficulty: 'medium' as const
      },
      {
        title: 'Bandit Checkpoint',
        description: 'Armed bandits have set up a roadblock, demanding a toll from all travelers.',
        setting: 'Mountain pass',
        enemies: [
          { name: 'Bandit Captain', hitPoints: 65, armorClass: 15, attackBonus: 5, damage: '1d6+3', description: 'Grizzled human in studded leather with a wicked scimitar' },
          { name: 'Bandit Thug', hitPoints: 11, armorClass: 12, attackBonus: 3, damage: '1d6+1', description: 'Rough-looking human with a club and leather armor' }
        ],
        options: ['Pay the toll', 'Refuse and prepare to fight', 'Try to negotiate a lower price', 'Attempt to sneak around'],
        difficulty: 'medium' as const
      },
      {
        title: 'Animated Armor',
        description: 'A suit of ancient plate armor clanks to life, animated by magical forces to guard this chamber.',
        setting: 'Wizard\'s tower',
        enemies: [
          { name: 'Animated Armor', hitPoints: 33, armorClass: 18, attackBonus: 4, damage: '1d6+2', description: 'Empty plate armor moving on its own, wielding a longsword' }
        ],
        options: ['Attack with physical weapons', 'Use magic against it', 'Try to disable the animating magic', 'Attempt to get past it'],
        difficulty: 'hard' as const
      }
    ];

    const encounter = combatEncounters[Math.floor(Math.random() * combatEncounters.length)];
    return {
      type: 'combat',
      ...encounter
    };
  }

  private generateRoleplayEncounter(): Encounter {
    const roleplayEncounters = [
      {
        title: 'Mysterious Merchant',
        description: 'A hooded figure approaches you with a cart full of unusual wares. "Travelers! I have exactly what you need... for the right price."',
        setting: 'Crossroads at twilight',
        options: ['Examine their wares', 'Ask about their travels', 'Be suspicious and decline', 'Try to learn more about them']
      },
      {
        title: 'Village Elder\'s Request',
        description: 'An elderly woman approaches you urgently. "Please, brave adventurers! Our village needs your help. Strange lights have been seen in the old ruins."',
        setting: 'Village square',
        options: ['Agree to help immediately', 'Ask for more details about the problem', 'Negotiate for payment', 'Decline and suggest they find local guards']
      },
      {
        title: 'Talking Raven',
        description: 'A large raven lands nearby and speaks in a croaky voice: "Message for you, travelers. The path ahead holds great danger... and great reward."',
        setting: 'Ancient stone bridge',
        options: ['Ask who sent the message', 'Inquire about the danger ahead', 'Try to catch the raven', 'Thank the raven and continue']
      },
      {
        title: 'Tavern Brawl',
        description: 'The tavern erupts into chaos as two groups of patrons begin fighting over a card game. Tables are overturned and fists are flying.',
        setting: 'Crowded tavern',
        options: ['Join the fight on one side', 'Try to break up the fight', 'Sneak out during the chaos', 'Use magic to calm everyone down']
      },
      {
        title: 'Lost Child',
        description: 'A young child runs up to you, tears streaming down their face. "Have you seen my puppy? He ran into the dark forest and I\'m scared to go after him!"',
        setting: 'Edge of a dark forest',
        options: ['Offer to help find the puppy', 'Comfort the child and bring them to their parents', 'Give them advice but don\'t get involved', 'Ask other villagers for help']
      },
      {
        title: 'Ancient Spirit',
        description: 'A translucent figure materializes before you. "I have guarded this sacred grove for centuries. State your business here, mortals."',
        setting: 'Sacred grove with ancient stones',
        options: ['Explain you are just passing through', 'Ask about the grove\'s history', 'Challenge the spirit\'s authority', 'Offer to help with something']
      },
      {
        title: 'Riddle of the Sphinx',
        description: 'A majestic sphinx blocks the path ahead. "Answer my riddle correctly, and you may pass. Fail, and face my wrath. What walks on four legs at dawn, two legs at noon, and three legs at dusk?"',
        setting: 'Desert temple entrance',
        options: ['Answer: A human (crawls as baby, walks as adult, uses cane when old)', 'Ask for a different riddle', 'Try to fight the sphinx', 'Attempt to go around']
      },
      {
        title: 'Competing Adventurers',
        description: 'Another group of adventurers approaches the same treasure site as you. Their leader calls out, "We were here first! Find your own adventure!"',
        setting: 'Entrance to ancient ruins',
        options: ['Propose working together', 'Challenge them to prove who arrived first', 'Suggest splitting any treasure found', 'Try to sneak in while they\'re distracted']
      }
    ];

    const encounter = roleplayEncounters[Math.floor(Math.random() * roleplayEncounters.length)];
    return {
      type: 'roleplay',
      ...encounter
    };
  }

  // Generate a quick adventure hook
  generateAdventureHook(): string {
    const hooks = [
      "You've heard rumors of a hidden treasure in the nearby Whispering Woods, but the locals warn of strange creatures guarding it.",
      "A mysterious letter arrives asking you to meet someone at midnight in the old cemetery. The reward mentioned is substantial.",
      "The local tavern keeper offers you free room and board if you can solve the mystery of their missing ale barrels.",
      "A group of merchants begs you to escort them through the Shadowpass Mountains, where bandits have been attacking caravans.",
      "An ancient map falls into your possession, leading to what appears to be a forgotten dungeon beneath the city.",
      "The town's children have been having the same nightmare about a dark tower on the hill. Investigation is needed.",
      "A noble's prized stallion has escaped into the Enchanted Forest, and they're offering a handsome reward for its safe return.",
      "Strange lights and sounds come from the abandoned wizard's tower each night. The townspeople are getting nervous.",
      "A dying stranger gives you a crystal pendant and whispers, 'Take this to the Circle of Standing Stones before the new moon.'",
      "The local priest asks for your help investigating reports of undead rising from the old battleground."
    ];

    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  // Format dice roll results for display
  formatDiceRoll(roll: DiceRoll): string {
    if (roll.rolls.length === 1 && roll.modifiers === 0) {
      return `🎲 Rolling ${roll.dice}: **${roll.total}** ${this.getCriticalMessage(roll)}`;
    }

    const rollsText = roll.rolls.join(', ');
    const modifierText = roll.modifiers !== 0 ? ` ${roll.modifiers >= 0 ? '+' : ''}${roll.modifiers}` : '';
    const criticalMessage = this.getCriticalMessage(roll);

    return `🎲 Rolling ${roll.dice}: [${rollsText}]${modifierText} = **${roll.total}** ${criticalMessage}`;
  }

  private getCriticalMessage(roll: DiceRoll): string {
    if (roll.dice.includes('d20') && roll.rolls.length === 1) {
      if (roll.rolls[0] === 20) {
        return '🎉 **CRITICAL SUCCESS!** 🎉';
      } else if (roll.rolls[0] === 1) {
        return '💀 **CRITICAL FAILURE!** 💀';
      }
    }
    return '';
  }

  // Format character for display
  formatCharacter(character: Character): string {
    const statModifier = (stat: number) => {
      const mod = Math.floor((stat - 10) / 2);
      return mod >= 0 ? `+${mod}` : `${mod}`;
    };

    return `🧙‍♂️ **${character.name}** - ${character.race} ${character.class}
    
**Stats:**
• **STR:** ${character.stats.STR} (${statModifier(character.stats.STR)}) | **DEX:** ${character.stats.DEX} (${statModifier(character.stats.DEX)}) | **CON:** ${character.stats.CON} (${statModifier(character.stats.CON)})
• **INT:** ${character.stats.INT} (${statModifier(character.stats.INT)}) | **WIS:** ${character.stats.WIS} (${statModifier(character.stats.WIS)}) | **CHA:** ${character.stats.CHA} (${statModifier(character.stats.CHA)})

**Combat Stats:**
• **Hit Points:** ${character.hitPoints}
• **Armor Class:** ${character.armorClass}

**Equipment:** ${character.equipment.join(', ')}

**Trait:** ${character.trait}
**Background:** ${character.background}`;
  }

  // Format encounter for display
  formatEncounter(encounter: Encounter): string {
    let formatted = `⚔️ **${encounter.title}**\n\n${encounter.description}\n\n📍 **Setting:** ${encounter.setting}\n\n`;

    if (encounter.type === 'combat' && encounter.enemies) {
      formatted += '**Enemies:**\n';
      encounter.enemies.forEach(enemy => {
        formatted += `• **${enemy.name}** - AC ${enemy.armorClass}, HP ${enemy.hitPoints}\n  ${enemy.description}\n`;
      });
      formatted += '\n';
    }

    formatted += '**What do you do?**\n';
    encounter.options.forEach((option, index) => {
      formatted += `${index + 1}. ${option}\n`;
    });

    return formatted;
  }
}

export const dndService = new DNDService();
