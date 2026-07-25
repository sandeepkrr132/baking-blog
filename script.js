/* ========================================
   Sweet Crumbs Baking Blog - JavaScript
   ======================================== */

// ========================================
// Recipe Data (embedded for local file access)
// ========================================
const recipes = [
    {
        "id": "chocolate-chip-cookies",
        "title": "Classic Chocolate Chip Cookies",
        "image": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&h=600&fit=crop",
        "category": "cookies",
        "prepTime": 15,
        "cookTime": 12,
        "servings": 24,
        "difficulty": "Easy",
        "description": "Crispy on the edges, chewy in the center - the perfect chocolate chip cookie.",
        "ingredients": [
            {"amount": "2 1/4 cups", "name": "all-purpose flour"},
            {"amount": "1 tsp", "name": "baking soda"},
            {"amount": "1 tsp", "name": "salt"},
            {"amount": "1 cup (2 sticks)", "name": "butter, softened"},
            {"amount": "3/4 cup", "name": "granulated sugar"},
            {"amount": "3/4 cup", "name": "packed brown sugar"},
            {"amount": "2", "name": "large eggs"},
            {"amount": "2 tsp", "name": "vanilla extract"},
            {"amount": "2 cups", "name": "chocolate chips"}
        ],
        "steps": [
            {"text": "Preheat oven to 375°F (190°C). Line baking sheets with parchment paper.", "timerMinutes": null},
            {"text": "In a medium bowl, whisk together flour, baking soda, and salt. Set aside.", "timerMinutes": null},
            {"text": "In a large bowl, beat the softened butter with both sugars until light and fluffy.", "timerMinutes": 3, "timerLabel": "Cream butter & sugar"},
            {"text": "Beat in eggs one at a time, then add vanilla extract.", "timerMinutes": null},
            {"text": "Gradually mix in the flour mixture until just combined.", "timerMinutes": null},
            {"text": "Fold in chocolate chips with a spatula.", "timerMinutes": null},
            {"text": "Drop rounded tablespoons of dough onto prepared baking sheets, spacing 2 inches apart.", "timerMinutes": null},
            {"text": "Bake until golden brown on edges but still soft in the center.", "timerMinutes": 12, "timerLabel": "Bake time"},
            {"text": "Let cool on baking sheet for 5 minutes, then transfer to wire rack.", "timerMinutes": 5, "timerLabel": "Cooling time"}
        ]
    },
    {
        "id": "vanilla-cupcakes",
        "title": "Fluffy Vanilla Cupcakes",
        "image": "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=800&h=600&fit=crop",
        "category": "cakes",
        "prepTime": 20,
        "cookTime": 20,
        "servings": 12,
        "difficulty": "Easy",
        "description": "Light, fluffy vanilla cupcakes topped with creamy buttercream frosting.",
        "ingredients": [
            {"amount": "1 1/2 cups", "name": "all-purpose flour"},
            {"amount": "1 1/2 tsp", "name": "baking powder"},
            {"amount": "1/4 tsp", "name": "salt"},
            {"amount": "1/2 cup", "name": "butter, softened"},
            {"amount": "3/4 cup", "name": "granulated sugar"},
            {"amount": "2", "name": "large eggs"},
            {"amount": "2 tsp", "name": "vanilla extract"},
            {"amount": "1/2 cup", "name": "whole milk"},
            {"amount": "1 cup", "name": "butter for frosting"},
            {"amount": "3 cups", "name": "powdered sugar"},
            {"amount": "1-2 tbsp", "name": "heavy cream"}
        ],
        "steps": [
            {"text": "Preheat oven to 350°F (175°C). Line a 12-cup muffin tin with cupcake liners.", "timerMinutes": null},
            {"text": "Whisk together flour, baking powder, and salt in a medium bowl.", "timerMinutes": null},
            {"text": "In a large bowl, cream butter and sugar until light and fluffy.", "timerMinutes": 4, "timerLabel": "Cream butter & sugar"},
            {"text": "Add eggs one at a time, beating well after each. Mix in vanilla.", "timerMinutes": null},
            {"text": "Alternate adding flour mixture and milk to the butter mixture, starting and ending with flour. Mix until just combined.", "timerMinutes": null},
            {"text": "Divide batter evenly among cupcake liners (about 2/3 full).", "timerMinutes": null},
            {"text": "Bake until a toothpick inserted in center comes out clean.", "timerMinutes": 20, "timerLabel": "Bake time"},
            {"text": "Cool in pan for 5 minutes, then transfer to wire rack to cool completely.", "timerMinutes": 15, "timerLabel": "Cool completely"},
            {"text": "For frosting: Beat butter until creamy, gradually add powdered sugar, then cream until fluffy.", "timerMinutes": 5, "timerLabel": "Make frosting"},
            {"text": "Frost cooled cupcakes and decorate as desired.", "timerMinutes": null}
        ]
    },
    {
        "id": "sourdough-bread",
        "title": "Rustic Sourdough Bread",
        "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop",
        "category": "bread",
        "prepTime": 30,
        "cookTime": 45,
        "servings": 8,
        "difficulty": "Intermediate",
        "description": "Crusty artisan sourdough with a chewy, tangy interior.",
        "ingredients": [
            {"amount": "500g", "name": "bread flour"},
            {"amount": "350g", "name": "warm water"},
            {"amount": "100g", "name": "active sourdough starter"},
            {"amount": "10g", "name": "salt"},
            {"amount": "1 tbsp", "name": "olive oil (for bowl)"}
        ],
        "steps": [
            {"text": "In a large bowl, mix flour and water until no dry bits remain. Let rest (autolyse).", "timerMinutes": 30, "timerLabel": "Autolyse"},
            {"text": "Add sourdough starter and salt. Mix and fold until fully incorporated.", "timerMinutes": 10, "timerLabel": "Mix & fold"},
            {"text": "Perform stretch and folds every 30 minutes for the first 2 hours.", "timerMinutes": 120, "timerLabel": "Stretch & folds"},
            {"text": "Cover and let the dough rise at room temperature until doubled.", "timerMinutes": 240, "timerLabel": "Bulk fermentation"},
            {"text": "Turn dough onto lightly floured surface. Shape into a round boule.", "timerMinutes": null},
            {"text": "Place seam-side up in a floured banneton or bowl. Cover and refrigerate overnight.", "timerMinutes": 480, "timerLabel": "Cold proof (or overnight)"},
            {"text": "Preheat oven to 500°F (260°C) with Dutch oven inside for at least 45 minutes.", "timerMinutes": 45, "timerLabel": "Preheat Dutch oven"},
            {"text": "Carefully place dough in hot Dutch oven. Score the top with a razor blade.", "timerMinutes": null},
            {"text": "Bake covered for 30 minutes, then remove lid and bake until deep golden brown.", "timerMinutes": 15, "timerLabel": "Uncovered bake"},
            {"text": "Transfer to wire rack and let cool completely before slicing.", "timerMinutes": 60, "timerLabel": "Cool completely"}
        ]
    },
    {
        "id": "banana-bread",
        "title": "Moist Banana Bread",
        "image": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&h=600&fit=crop",
        "category": "cakes",
        "prepTime": 15,
        "cookTime": 60,
        "servings": 10,
        "difficulty": "Easy",
        "description": "Super moist banana bread with a crispy top. The more brown spots on your bananas, the better!",
        "ingredients": [
            {"amount": "3", "name": "ripe bananas, mashed"},
            {"amount": "1/3 cup", "name": "melted butter"},
            {"amount": "3/4 cup", "name": "sugar"},
            {"amount": "1", "name": "large egg, beaten"},
            {"amount": "1 tsp", "name": "vanilla extract"},
            {"amount": "1 tsp", "name": "baking soda"},
            {"amount": "pinch", "name": "salt"},
            {"amount": "1 1/2 cups", "name": "all-purpose flour"},
            {"amount": "1/2 cup", "name": "chocolate chips (optional)"}
        ],
        "steps": [
            {"text": "Preheat oven to 350°F (175°C). Grease a 9x5 inch loaf pan.", "timerMinutes": null},
            {"text": "In a large bowl, mash the bananas with a fork until smooth.", "timerMinutes": null},
            {"text": "Stir in melted butter, sugar, beaten egg, and vanilla extract.", "timerMinutes": null},
            {"text": "Sprinkle baking soda and salt over the mixture, stir to combine.", "timerMinutes": null},
            {"text": "Add flour and stir until just combined. Do not overmix!", "timerMinutes": null},
            {"text": "Fold in chocolate chips if using.", "timerMinutes": null},
            {"text": "Pour batter into prepared loaf pan.", "timerMinutes": null},
            {"text": "Bake until a toothpick inserted in the center comes out clean.", "timerMinutes": 60, "timerLabel": "Bake time"},
            {"text": "Let cool in pan for 10 minutes, then turn out onto wire rack.", "timerMinutes": 10, "timerLabel": "Cool in pan"},
            {"text": "Slice and serve warm or at room temperature. Enjoy!", "timerMinutes": null}
        ]
    }
];

// Timer state management
const timers = {};

// ========================================
// Audio Alert using Web Audio API
// ========================================
function playAlertSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Play 3 rounds of ascending chimes for a noticeable alert
        const chimeNotes = [
            [523.25, 659.25, 783.99],  // C5-E5-G5
            [659.25, 783.99, 1046.50], // E5-G5-C6
            [523.25, 659.25, 783.99],  // C5-E5-G5
        ];

        chimeNotes.forEach((chord, round) => {
            const roundStart = audioContext.currentTime + round * 0.5;

            chord.forEach((freq, noteIndex) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = freq;
                oscillator.type = 'sine';

                const noteTime = roundStart + noteIndex * 0.12;
                gainNode.gain.setValueAtTime(0, noteTime);
                gainNode.gain.linearRampToValueAtTime(0.4, noteTime + 0.04);
                gainNode.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.35);

                oscillator.start(noteTime);
                oscillator.stop(noteTime + 0.35);
            });
        });
    } catch (e) {
        console.log('Audio not supported');
    }
}

// ========================================
// Vibration Alert (mobile devices)
// ========================================
function vibrateAlert() {
    try {
        if (navigator.vibrate) {
            // Pattern: vibrate-pause-vibrate-pause-vibrate (long pulses)
            navigator.vibrate([300, 150, 300, 150, 500]);
        }
    } catch (e) {
        // Vibration not supported
    }
}

// ========================================
// Toast Notification
// ========================================
function showToast(message, duration = 5000) {
    // Remove any existing toast
    const existing = document.querySelector('.timer-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'timer-toast';
    toast.innerHTML = `
        <span class="timer-toast-icon">⏰</span>
        <span class="timer-toast-text">${message}</span>
        <button class="timer-toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(toast);

    // Trigger slide-in animation
    requestAnimationFrame(() => toast.classList.add('timer-toast-visible'));

    // Auto-dismiss after duration
    setTimeout(() => {
        toast.classList.remove('timer-toast-visible');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// ========================================
// Format time as MM:SS
// ========================================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ========================================
// Timer Functions
// ========================================
function startTimer(timerId) {
    const timer = timers[timerId];
    if (!timer || timer.running) return;

    timer.running = true;
    updateTimerDisplay(timerId);

    timer.interval = setInterval(() => {
        timer.remaining--;

        if (timer.remaining <= 0) {
            // Timer finished!
            clearInterval(timer.interval);
            timer.running = false;
            timer.remaining = 0;
            timer.finished = true;
            updateTimerDisplay(timerId);
            playAlertSound();
            vibrateAlert();
            showToast(`Timer Complete: ${timer.label} is done!`);
        } else {
            updateTimerDisplay(timerId);
        }
    }, 1000);
}

function pauseTimer(timerId) {
    const timer = timers[timerId];
    if (!timer || !timer.running) return;

    clearInterval(timer.interval);
    timer.running = false;
    updateTimerDisplay(timerId);
}

function resetTimer(timerId) {
    const timer = timers[timerId];
    if (!timer) return;

    clearInterval(timer.interval);
    timer.running = false;
    timer.remaining = timer.totalSeconds;
    timer.finished = false;
    updateTimerDisplay(timerId);
}

function updateTimerDisplay(timerId) {
    const timer = timers[timerId];
    const display = document.getElementById(`timer-display-${timerId}`);
    const startBtn = document.getElementById(`timer-start-${timerId}`);
    const pauseBtn = document.getElementById(`timer-pause-${timerId}`);

    if (!display) return;

    display.textContent = formatTime(timer.remaining);

    // Add warning class when less than 30 seconds
    display.classList.remove('warning', 'finished');
    if (timer.finished) {
        display.classList.add('finished');
    } else if (timer.remaining <= 30 && timer.remaining > 0) {
        display.classList.add('warning');
    }

    // Update button states
    if (startBtn && pauseBtn) {
        startBtn.disabled = timer.running;
        pauseBtn.disabled = !timer.running;
    }
}

// ========================================
// Render Recipe Cards (Homepage)
// ========================================
function renderRecipeCards(recipesList, container) {
    container.innerHTML = recipesList.map(recipe => `
        <article class="recipe-card" data-category="${recipe.category}" onclick="window.location.href='recipe.html?id=${recipe.id}'">
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-card-image" loading="lazy">
            <div class="recipe-card-content">
                <span class="recipe-card-category">${recipe.category}</span>
                <h3 class="recipe-card-title">${recipe.title}</h3>
                <p class="recipe-card-description">${recipe.description}</p>
                <div class="recipe-card-meta">
                    <span>⏱️ ${recipe.prepTime + recipe.cookTime} min</span>
                    <span>👥 ${recipe.servings} servings</span>
                    <span>📊 ${recipe.difficulty}</span>
                </div>
            </div>
        </article>
    `).join('');
}

// ========================================
// Setup Category Filter
// ========================================
function setupCategoryFilter(container) {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const category = btn.dataset.category;
            const filtered = category === 'all'
                ? recipes
                : recipes.filter(r => r.category === category);

            renderRecipeCards(filtered, container);
        });
    });
}

// ========================================
// Load Homepage
// ========================================
function loadHomepage() {
    const grid = document.getElementById('recipeGrid');
    if (!grid) return;

    renderRecipeCards(recipes, grid);
    setupCategoryFilter(grid);
}

// ========================================
// Load Single Recipe
// ========================================
function loadRecipePage() {
    const heroSection = document.getElementById('recipeHero');
    const ingredientsList = document.getElementById('ingredientsList');
    const stepsContainer = document.getElementById('stepsContainer');

    if (!heroSection || !ingredientsList || !stepsContainer) return;

    // Get recipe ID from URL
    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get('id');

    if (!recipeId) {
        heroSection.innerHTML = '<p class="loading">No recipe selected. <a href="index.html">Browse recipes</a></p>';
        return;
    }

    const recipe = recipes.find(r => r.id === recipeId);

    if (!recipe) {
        heroSection.innerHTML = '<p class="loading">Recipe not found. <a href="index.html">Browse recipes</a></p>';
        return;
    }

    // Update page title
    document.title = `${recipe.title} | Sweet Crumbs`;

    // Render hero
    heroSection.innerHTML = `
        <div class="recipe-hero-content">
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-hero-image">
            <div class="recipe-hero-info">
                <h1>${recipe.title}</h1>
                <p class="recipe-hero-description">${recipe.description}</p>
                <div class="recipe-meta">
                    <div class="recipe-meta-item">
                        <div class="recipe-meta-label">Prep Time</div>
                        <div class="recipe-meta-value">${recipe.prepTime} min</div>
                    </div>
                    <div class="recipe-meta-item">
                        <div class="recipe-meta-label">Cook Time</div>
                        <div class="recipe-meta-value">${recipe.cookTime} min</div>
                    </div>
                    <div class="recipe-meta-item">
                        <div class="recipe-meta-label">Servings</div>
                        <div class="recipe-meta-value">${recipe.servings}</div>
                    </div>
                    <div class="recipe-meta-item">
                        <div class="recipe-meta-label">Difficulty</div>
                        <div class="recipe-meta-value">${recipe.difficulty}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Render ingredients
    ingredientsList.innerHTML = recipe.ingredients.map((ing, index) => `
        <li class="ingredient-item" data-index="${index}" onclick="toggleIngredient(this)">
            <div class="ingredient-checkbox"></div>
            <span class="ingredient-amount">${ing.amount}</span>
            <span class="ingredient-name">${ing.name}</span>
        </li>
    `).join('');

    // Render steps with timers
    stepsContainer.innerHTML = recipe.steps.map((step, index) => {
        const stepId = `step-${index}`;
        let timerHtml = '';

        if (step.timerMinutes) {
            const totalSeconds = step.timerMinutes * 60;
            timers[stepId] = {
                totalSeconds: totalSeconds,
                remaining: totalSeconds,
                running: false,
                finished: false,
                label: step.timerLabel || `Step ${index + 1}`,
                interval: null
            };

            timerHtml = `
                <div class="timer-container">
                    <span class="timer-label">⏱️ ${step.timerLabel || 'Timer'}:</span>
                    <span class="timer-display" id="timer-display-${stepId}">${formatTime(totalSeconds)}</span>
                    <div class="timer-buttons">
                        <button class="timer-btn timer-btn-start" id="timer-start-${stepId}" onclick="startTimer('${stepId}')">Start</button>
                        <button class="timer-btn timer-btn-pause" id="timer-pause-${stepId}" onclick="pauseTimer('${stepId}')" disabled>Pause</button>
                        <button class="timer-btn timer-btn-reset" onclick="resetTimer('${stepId}')">Reset</button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="step" id="${stepId}">
                <div class="step-header">
                    <span class="step-number">${index + 1}</span>
                    <p class="step-text">${step.text}</p>
                </div>
                ${timerHtml}
                <button class="step-complete-btn" onclick="toggleStepComplete('${stepId}')">
                    Mark Complete
                </button>
            </div>
        `;
    }).join('');
}

// ========================================
// Ingredient Toggle
// ========================================
function toggleIngredient(element) {
    element.classList.toggle('checked');
}

// ========================================
// Step Complete Toggle
// ========================================
function toggleStepComplete(stepId) {
    const stepEl = document.getElementById(stepId);
    if (!stepEl) return;

    stepEl.classList.toggle('completed');

    // If marking as complete and timer is running, stop it
    if (stepEl.classList.contains('completed') && timers[stepId] && timers[stepId].running) {
        pauseTimer(stepId);
    }
}

// ========================================
// Initialize on DOM Load
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the homepage or recipe page
    if (document.getElementById('recipeGrid')) {
        loadHomepage();
    } else if (document.getElementById('recipeHero')) {
        loadRecipePage();
    }
});

// Clean up intervals on page unload
window.addEventListener('beforeunload', () => {
    Object.keys(timers).forEach(timerId => {
        if (timers[timerId].interval) {
            clearInterval(timers[timerId].interval);
        }
    });
});
