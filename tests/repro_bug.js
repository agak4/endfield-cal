const fs = require('fs');
const path = require('path');

// Mock DOM
global.document = {
    getElementById: () => null
};

// Functions to load file content
const loadFile = (filePath) => {
    return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
};

const fileOrder = [
    'data_operators.js',
    'data_weapons.js',
    'data_gears.js',
    'js/state.js',
    'js/calc.js'
];

let globalCode = '';
fileOrder.forEach(f => {
    globalCode += loadFile(f) + '\n';
});

// Append test logic
globalCode += `
(function() {
    console.log("Starting Test...");

    // Setup Endministrator
    const endmin = DATA_OPERATORS.find(o => o.id === 'Endministrator');
    if (!endmin) {
        console.error("Endministrator not found!");
        return;
    }
    
    // Initialize State
    state.mainOp.id = 'Endministrator';
    state.mainOp.pot = 0;
    // Set weapon
    if (endmin.usableWeapons && endmin.usableWeapons.length > 0) {
        const wep = DATA_WEAPONS.find(w => w.type === endmin.usableWeapons[0]);
        state.mainOp.wepId = wep ? wep.id : null;
    }
    
    // Set Special Stack
    // Correct format: { originiumSeal: 1 }
    state.mainOp.specialStack = { originiumSeal: 1 };
    
    state.disabledEffects = [];
    state.debuffState = {
        physDebuff: { defenseless: 0, armorBreak: 0, combo: 0 },
        artsAttach: { type: null, stacks: 0 },
        artsAbnormal: { '연소': 0, '감전': 0, '동결': 0, '부식': 0 }
    };

    // Set skill sequence to verify Ultimate
    state.skillSequence = [{ type: '궁극기' }];
    
    console.log("Calculating damage for Endministrator Ultimate with Originium Seal active...");
    
    // Calculate
    const baseRes = calculateDamage(state);
    const cycleRes = calculateCycleDamage(state, baseRes);
    
    if (!cycleRes || !cycleRes.sequence || cycleRes.sequence.length === 0) {
        console.error("Calculation failed or empty sequence.");
        return;
    }
    
    const ultRes = cycleRes.sequence[0];
    const bonusList = ultRes.bonusList || [];
    
    console.log("Bonus List:", JSON.stringify(bonusList, null, 2));
    
    const hasBonus = bonusList.some(b => b.name && b.name.includes('오리지늄 결정'));
    
    if (hasBonus) {
        console.log("PASS: '오리지늄 결정' bonus is applied.");
    } else {
        console.log("FAIL: '오리지늄 결정' bonus is NOT applied.");
        // Try to debug why
        console.log("Special Stack in state:", JSON.stringify(state.mainOp.specialStack));
    }

    console.log("\n--- Testing Levatain ---");
    // Setup Levatain
    const lev = DATA_OPERATORS.find(o => o.id === 'Laevatain');
    if (lev) {
        state.mainOp.id = 'Laevatain';
        state.mainOp.pot = 0;
        state.mainOp.specialStack = { default: 1 };
        
        // Levatain Battle Skill uses bonus
        state.skillSequence = [{ type: '배틀 스킬' }];
        
        const levBaseRes = calculateDamage(state);
        const levCycleRes = calculateCycleDamage(state, levBaseRes);
        const levSkillRes = levCycleRes.sequence[0];
        const levBonusList = levSkillRes.bonusList || [];
        
        console.log("Levatain Bonus List:", JSON.stringify(levBonusList, null, 2));
        const levHasBonus = levBonusList.some(b => b.name && b.name.includes('녹아내린 불꽃'));
        
        if (levHasBonus) {
             console.log("PASS: Levatain bonus is applied.");
        } else {
             console.log("FAIL: Levatain bonus is NOT applied.");
        }
    }
})();
`;

try {
    // Run the code in global context
    // We use new Function to avoid scope issues if we just eval, but eval is easier for "global" vars.
    // However, node runs modules in a wrapper. To make "const DATA_OPERATORS" global, we rely on eval being in module scope but simulating global if vars are not strict?
    // Actually, top-level const in eval persists in local scope.
    // Let's use vm module for cleaner execution context.
    const vm = require('vm');
    const context = { 
        console: console, 
        document: global.document, 
        localStorage: { getItem: () => null, setItem: () => {} }
    };
    vm.createContext(context);
    vm.runInContext(globalCode, context);
    
} catch (e) {
    console.error("Execution Error:", e);
}
