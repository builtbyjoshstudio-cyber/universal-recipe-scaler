document.addEventListener('DOMContentLoaded', () => {
    const recipeInput = document.getElementById('recipe-input');
    const recipeOutput = document.getElementById('recipe-output');
    const scaleButtons = document.querySelectorAll('.scale-btn');
    const customScaleBtn = document.getElementById('apply-custom-scale');
    const originalServings = document.getElementById('original-servings');
    const targetServings = document.getElementById('target-servings');
    const currentMultiplierDisplay = document.getElementById('current-multiplier-display');

    let currentMultiplier = 1;

    // Parse string to float (handles basic fractions like 1/2, 1 1/4)
    function parseNumber(str) {
        str = str.trim();
        if (str.includes('/')) {
            const parts = str.split(/\s+/);
            if (parts.length > 1) {
                const fraction = parts[1].split('/');
                return parseFloat(parts[0]) + (parseFloat(fraction[0]) / parseFloat(fraction[1]));
            } else {
                const fraction = str.split('/');
                return parseFloat(fraction[0]) / parseFloat(fraction[1]);
            }
        }
        return parseFloat(str);
    }

    // Float to readable fraction
    function toFraction(num) {
        if (isNaN(num) || num <= 0) return '';
        
        const tolerance = 1.0E-6;
        
        const fractions = [
            { val: 0, text: '' },
            { val: 1/8, text: '1/8' },
            { val: 1/4, text: '1/4' },
            { val: 1/3, text: '1/3' },
            { val: 3/8, text: '3/8' },
            { val: 1/2, text: '1/2' },
            { val: 5/8, text: '5/8' },
            { val: 2/3, text: '2/3' },
            { val: 3/4, text: '3/4' },
            { val: 7/8, text: '7/8' }
        ];

        let whole = Math.floor(num + tolerance);
        let decimal = num - whole;
        
        if (1 - decimal < tolerance) {
            whole += 1;
            decimal = 0;
        }

        let closestFraction = fractions[0];
        let minDiff = 1;

        for (let f of fractions) {
            const diff = Math.abs(decimal - f.val);
            if (diff < minDiff) {
                minDiff = diff;
                closestFraction = f;
            }
        }

        if (minDiff > 0.05) {
            let res = Number.isInteger(num) ? num.toString() : num.toFixed(2).replace(/\.00$/, '');
            return res;
        }

        if (closestFraction.val === 0) {
            return whole > 0 ? whole.toString() : '0';
        }

        if (whole === 0) {
            return closestFraction.text;
        }

        return `${whole} ${closestFraction.text}`;
    }

    function scaleRecipe() {
        const text = recipeInput.value;
        if (!text.trim()) {
            recipeOutput.innerHTML = '<p class="placeholder-text">Your scaled ingredients will appear here...</p>';
            return;
        }

        // Regex to match numbers, including fractions at the start of ingredient lines
        const numberRegex = /^(\s*)(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)/;
        
        const lines = text.split('\n');
        let scaledLines = lines.map(line => {
            // First let's check for standard quantities at the start of the line
            let match = numberRegex.exec(line);
            
            if (match) {
                const spaces = match[1];
                const originalNumStr = match[2];
                const num = parseNumber(originalNumStr);
                
                if (!isNaN(num)) {
                    const scaledNum = num * currentMultiplier;
                    const fractionStr = toFraction(scaledNum);
                    
                    const after = line.substring(match[0].length);
                    return `${spaces}<span class="highlight">${fractionStr}</span>${after}`;
                }
            } else {
                // If there's no number at the very start, let's try a more general scan for numbers followed by units
                // e.g. "Salt, 1 tsp"
                const unitRegex = /(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s*(cups?|tbsp|tsp|oz|grams?|g|ml|lbs?|pinch|dash|cloves?|pieces?)/i;
                let unitMatch = unitRegex.exec(line);
                if (unitMatch) {
                    const originalNumStr = unitMatch[1];
                    const num = parseNumber(originalNumStr);
                    if (!isNaN(num)) {
                        const scaledNum = num * currentMultiplier;
                        const fractionStr = toFraction(scaledNum);
                        
                        const before = line.substring(0, unitMatch.index);
                        const after = line.substring(unitMatch.index + originalNumStr.length);
                        return `${before}<span class="highlight">${fractionStr}</span>${after}`;
                    }
                }
            }
            
            return line;
        });

        recipeOutput.innerHTML = scaledLines.join('<br>');
    }

    // Event Listeners
    recipeInput.addEventListener('input', scaleRecipe);

    scaleButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            scaleButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentMultiplier = parseFloat(e.target.dataset.scale);
            currentMultiplierDisplay.textContent = `${currentMultiplier}x`;
            
            scaleRecipe();
        });
    });

    customScaleBtn.addEventListener('click', () => {
        const orig = parseFloat(originalServings.value);
        const target = parseFloat(targetServings.value);
        
        if (orig > 0 && target > 0) {
            currentMultiplier = target / orig;
            
            scaleButtons.forEach(b => b.classList.remove('active'));
            
            let displayMult = Number.isInteger(currentMultiplier) ? currentMultiplier : currentMultiplier.toFixed(2);
            currentMultiplierDisplay.textContent = `${displayMult}x`;
            
            scaleRecipe();
        }
    });
    
    // Initial active state
    document.querySelector('.scale-btn[data-scale="1"]').classList.add('active');
    
    // Trigger initial scale just in case there's text (e.g. browser reload preserved it)
    scaleRecipe();
});
