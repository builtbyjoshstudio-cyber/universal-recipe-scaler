document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themes = ['dark', 'light', 'mist'];
    let currentThemeIndex = 0;

    const savedTheme = localStorage.getItem('themePref');
    if (savedTheme && themes.includes(savedTheme)) {
        currentThemeIndex = themes.indexOf(savedTheme);
    }

    const applyTheme = () => {
        const newTheme = themes[currentThemeIndex];
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('themePref', newTheme);
        
        const capitalizedTheme = newTheme.charAt(0).toUpperCase() + newTheme.slice(1);
        if (themeToggleBtn) {
            themeToggleBtn.textContent = `Theme: ${capitalizedTheme}`;
        }
    };

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            currentThemeIndex = (currentThemeIndex + 1) % themes.length;
            applyTheme();
        });
    }
    applyTheme();

    const recipeInput = document.getElementById('recipe-input');
    const recipeOutput = document.getElementById('recipe-output');
    const scaleButtons = document.querySelectorAll('.scale-btn');
    const customScaleBtn = document.getElementById('apply-custom-scale');
    const originalServings = document.getElementById('original-servings');
    const targetServings = document.getElementById('target-servings');
    const currentMultiplierDisplay = document.getElementById('current-multiplier-display');
    const unitImperialBtn = document.getElementById('unit-imperial');
    const unitMetricBtn = document.getElementById('unit-metric');
    let currentUnit = 'imperial';
    const copyBtn = document.getElementById('copy-btn');
    const printBtn = document.getElementById('print-btn');

    let currentMultiplier = 1;

    // Load saved recipe from local storage
    const savedRecipe = localStorage.getItem('savedRecipe');
    if (savedRecipe) {
        recipeInput.value = savedRecipe;
    }

    // Parse string to float
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

    // Float to readable fraction (approximating to practical cooking measurements)
    function toFraction(num) {
        if (isNaN(num) || num <= 0) return '';
        
        const tolerance = 1.0E-6;
        const fractions = [
            { val: 0, text: '' },
            { val: 1/4, text: '1/4' },
            { val: 1/3, text: '1/3' },
            { val: 1/2, text: '1/2' },
            { val: 2/3, text: '2/3' },
            { val: 3/4, text: '3/4' },
            { val: 1, text: '' } // handle rounding up to next whole
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

        if (closestFraction.val === 1) {
            whole += 1;
            closestFraction = fractions[0];
        }

        if (minDiff > 0.1) {
            // If it doesn't cleanly round to a practical cooking fraction, try to just show sensible decimals.
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
        localStorage.setItem('savedRecipe', text);

        const eggTipBox = document.getElementById('egg-tip-box');
        const volumetricWarningBox = document.getElementById('volumetric-warning-box');

        if (!text.trim()) {
            recipeOutput.innerHTML = '<p class="placeholder-text">Your scaled ingredients will appear here...</p>';
            if (eggTipBox) eggTipBox.style.display = 'none';
            if (volumetricWarningBox) volumetricWarningBox.style.display = 'none';
            return;
        }

        const convertToMetric = (currentUnit === 'metric');
        const lines = text.split('\n');
        
        recipeOutput.innerHTML = ''; // Clear previous output
        
        let hasFractionalEggs = false;

        const unitRegex = /(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s*(cups?|c\.?|tablespoons?|tbsps?\.?|teaspoons?|tsps?\.?|fluid\s*ounces?|fl\.?\s*oz\.?|ounces?|ozs?\.?|grams?|g\.?|milliliters?|ml\.?|pounds?|lbs?\.?|quarts?|qts?\.?|pints?|pts?\.?|gallons?|gals?\.?|°?f|fahrenheit|inches|inch|in\.?|pinch(?:es)?|dash(?:es)?|cloves?|pieces?)\b/gi;
        const startNumberRegex = /^(\s*)(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)(?!\s*(?:cups?|c\.?|tablespoons?|tbsps?\.?|teaspoons?|tsps?\.?|fluid\s*ounces?|fl\.?\s*oz\.?|ounces?|ozs?\.?|grams?|g\.?|milliliters?|ml\.?|pounds?|lbs?\.?|quarts?|qts?\.?|pints?|pts?\.?|gallons?|gals?\.?|°?f|fahrenheit|inches|inch|in\.?|pinch(?:es)?|dash(?:es)?|cloves?|pieces?)\b)/i;

        lines.forEach(line => {
            if (!line.trim()) {
                recipeOutput.appendChild(document.createElement('br'));
                return;
            }

            let processedLine = line;
            const isEggLine = /\beggs?\b/i.test(line);
            let lineHasFraction = false;

            // Globally replace all quantities with known units
            processedLine = processedLine.replace(unitRegex, (match, originalNumStr, unitStr) => {
                let num = parseNumber(originalNumStr);
                if (isNaN(num)) return match;

                let unit = unitStr.toLowerCase();
                let isF = /^(°?f|fahrenheit)$/.test(unit);
                let isIn = /^(inches|inch|in\.?)$/.test(unit);

                // Multiplier conditionally applied
                let scaledNum = num;
                if (!isF && !isIn) {
                    scaledNum = num * currentMultiplier;
                }

                if (isEggLine) {
                    const isFraction = Math.abs(scaledNum - Math.round(scaledNum)) > 0.01;
                    if (isFraction) {
                        lineHasFraction = true;
                        hasFractionalEggs = true;
                    }
                }

                let outUnit = unitStr; // preserve original case if possible
                let useFraction = true;

                // Normalize unit for conversion logic
                let isQt = /^(quarts?|qts?\.?)$/.test(unit);
                let isPt = /^(pints?|pts?\.?)$/.test(unit);
                let isGal = /^(gallons?|gals?\.?)$/.test(unit);
                let isCup = /^(cups?|c\.?)$/.test(unit);
                let isTbsp = /^(tablespoons?|tbsps?\.?)$/.test(unit);
                let isTsp = /^(teaspoons?|tsps?\.?)$/.test(unit);
                let isOz = /^(ounces?|ozs?\.?)$/.test(unit);
                let isFlOz = /^(fluid\s*ounces?|fl\.?\s*oz\.?)$/.test(unit);
                let isLb = /^(pounds?|lbs?\.?)$/.test(unit);
                let isG = /^(grams?|g\.?)$/.test(unit);
                let isMl = /^(milliliters?|ml\.?)$/.test(unit);

                if (convertToMetric) {
                    if (isTsp) { scaledNum *= 5; outUnit = 'ml'; useFraction = false; }
                    else if (isTbsp) { scaledNum *= 15; outUnit = 'ml'; useFraction = false; }
                    else if (isFlOz) { scaledNum *= 30; outUnit = 'ml'; useFraction = false; }
                    else if (isCup) { scaledNum *= 240; outUnit = 'ml'; useFraction = false; }
                    else if (isPt) { scaledNum *= 475; outUnit = 'ml'; useFraction = false; }
                    else if (isQt) { scaledNum *= 950; outUnit = 'ml'; useFraction = false; }
                    else if (isGal) { scaledNum *= 3.8; outUnit = 'L'; useFraction = false; }
                    else if (isOz) { scaledNum *= 28; outUnit = 'g'; useFraction = false; }
                    else if (isLb) { scaledNum *= 454; outUnit = 'g'; useFraction = false; }
                    else if (isIn) { scaledNum *= 2.5; outUnit = 'cm'; useFraction = false; }
                    else if (isF) {
                        scaledNum = (scaledNum - 32) * 5 / 9;
                        scaledNum = Math.round(scaledNum / 10) * 10;
                        outUnit = '°C';
                        useFraction = false;
                    }
                    
                    if (!useFraction) {
                        // Smart Formatting Rollovers
                        if (outUnit === 'ml' && scaledNum >= 1000) {
                            scaledNum /= 1000;
                            outUnit = 'L';
                        }
                        if (outUnit === 'g' && scaledNum >= 1000) {
                            scaledNum /= 1000;
                            outUnit = 'kg';
                        }

                        // Decimal strictness
                        if (outUnit === 'L') {
                            scaledNum = Number(scaledNum.toFixed(1));
                        } else if (outUnit === 'kg') {
                            scaledNum = Number(scaledNum.toFixed(2));
                        } else if (outUnit === 'ml' || outUnit === 'g' || outUnit === '°C') {
                            scaledNum = Math.round(scaledNum);
                        } else {
                            // Default fallback e.g. for cm or gal
                            scaledNum = Number(scaledNum.toFixed(1));
                        }
                    }
                } else {
                    // Metric to US Customary
                    if (isMl) {
                        let cups = scaledNum / 240;
                        if (cups >= 0.25) { scaledNum = cups; outUnit = scaledNum <= 1 ? 'cup' : 'cups'; }
                        else {
                            let tbsp = scaledNum / 15;
                            if (tbsp >= 0.5) { scaledNum = tbsp; outUnit = 'tbsp'; }
                            else { scaledNum = scaledNum / 5; outUnit = 'tsp'; }
                        }
                    } else if (isG || unit === 'kg') {
                        if (unit === 'kg') scaledNum *= 1000;
                        scaledNum /= 28.35; outUnit = 'oz';
                    }
                }

                let valStr = useFraction ? toFraction(scaledNum) : scaledNum.toString();
                // Ensure a single space between number and unit
                return `<span class="highlight">${valStr} ${outUnit}</span>`;
            });

            // Check if there's a unitless number at the start of the line that wasn't covered above
            let startMatch = startNumberRegex.exec(processedLine);
            if (startMatch) {
                const spaces = startMatch[1];
                const originalNumStr = startMatch[2];
                const num = parseNumber(originalNumStr);
                if (!isNaN(num)) {
                    const scaledNum = num * currentMultiplier;
                    const fractionStr = toFraction(scaledNum);
                    
                    if (isEggLine) {
                        const isFraction = Math.abs(scaledNum - Math.round(scaledNum)) > 0.01;
                        if (isFraction) {
                            lineHasFraction = true;
                            hasFractionalEggs = true;
                        }
                    }

                    processedLine = processedLine.substring(0, startMatch.index) + 
                                    spaces + `<span class="highlight">${fractionStr}</span>` + 
                                    processedLine.substring(startMatch.index + spaces.length + originalNumStr.length);
                }
            }

            // Create interactive checkbox row
            const label = document.createElement('label');
            label.className = 'recipe-line';
            if (isEggLine && lineHasFraction) {
                label.classList.add('fractional-egg-row');
            }
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            
            const span = document.createElement('span');
            span.className = 'recipe-text';
            span.innerHTML = processedLine;
            
            label.appendChild(checkbox);
            label.appendChild(span);
            
            recipeOutput.appendChild(label);
        });

        // Set egg tip display state
        if (eggTipBox) {
            eggTipBox.style.display = hasFractionalEggs ? 'block' : 'none';
        }

        // Volumetric scaling check
        const hasVolumetricUnits = /\b(cups?|tsp|tbsp)\b/i.test(text);
        if (volumetricWarningBox) {
            volumetricWarningBox.style.display = (currentMultiplier >= 3 && hasVolumetricUnits) ? 'block' : 'none';
        }
    }

    function setUnitSystem(unit) {
        currentUnit = unit;
        if (unit === 'metric') {
            unitMetricBtn.classList.add('active');
            unitImperialBtn.classList.remove('active');
        } else {
            unitImperialBtn.classList.add('active');
            unitMetricBtn.classList.remove('active');
        }
        scaleRecipe();
    }

    if (unitImperialBtn) unitImperialBtn.addEventListener('click', () => setUnitSystem('imperial'));
    if (unitMetricBtn) unitMetricBtn.addEventListener('click', () => setUnitSystem('metric'));
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

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const lines = document.querySelectorAll('.recipe-text');
            const textToCopy = Array.from(lines).map(l => l.innerText).join('\n');
            navigator.clipboard.writeText(textToCopy).then(() => {
                const origText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.textContent = origText, 2000);
            });
        });
    }

    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
    
    // Initial active state
    document.querySelector('.scale-btn[data-scale="1"]').classList.add('active');
    
    // Trigger initial scale
    scaleRecipe();
});
