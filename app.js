let players = [];
let currentRound = 1;
let isDarkMode = false;
let saveTimeout;
let history = [];

function updateUTCTime() {
    const now = new Date();
    document.getElementById("utcTime").textContent = now.toISOString().substring(11, 19) + " UTC";
}

setInterval(updateUTCTime, 1000);
updateUTCTime();

function getRiskLevel(score, limit) {
    if (score >= limit) {
        return { level: "eliminado", color: "#ef4444", textColor: "text-red-500", icon: "fa-solid fa-skull", remaining: 0 };
    }

    const remaining = limit - score;
    const percentage = (score / limit) * 100;

    if (percentage < 30) {
        return { level: "bajo", color: "#22c55e", textColor: "text-green-500", icon: "fa-regular fa-face-smile", remaining, barColor: "bg-green-500" };
    } else if (percentage < 60) {
        return { level: "medio", color: "#eab308", textColor: "text-yellow-500", icon: "fa-regular fa-face-meh", remaining, barColor: "bg-yellow-500" };
    } else if (percentage < 85) {
        return { level: "alto", color: "#f97316", textColor: "text-orange-500", icon: "fa-regular fa-face-frown", remaining, barColor: "bg-orange-500" };
    } else {
        return { level: "critico", color: "#ef4444", textColor: "text-red-500 font-bold", icon: "fa-solid fa-circle-exclamation", remaining, barColor: "bg-red-500", pulse: true };
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem("congaProData");
        if (saved) {
            const data = JSON.parse(saved);
            players = data.players || [];
            currentRound = data.currentRound || 1;
            history = data.history || [];

            if (data.limit) {
                document.getElementById("limitInput").value = data.limit;
            }

            if (data.theme === "dark") {
                document.documentElement.classList.add("dark");
                isDarkMode = true;
            } else {
                document.documentElement.classList.remove("dark");
                isDarkMode = false;
            }

            showAutoSaveIndicator("Datos cargados");
        }
    } catch (e) {
        console.error("Error cargando:", e);
    }
}

function saveToStorage() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const data = {
                players,
                currentRound,
                limit: parseInt(document.getElementById("limitInput").value) || 100,
                theme: isDarkMode ? "dark" : "light",
                lastSaved: new Date().toISOString(),
                history,
            };
            localStorage.setItem("congaProData", JSON.stringify(data));

            const timeStr = new Date().toISOString().substring(11, 19);
            showAutoSaveIndicator(`Guardado ${timeStr} UTC`);
        } catch (e) {
            console.error("Error guardando:", e);
        }
    }, 500);
}

function showAutoSaveIndicator(text) {
    const indicator = document.getElementById("autoSaveIndicator");
    document.getElementById("autoSaveText").textContent = text;
    indicator.classList.add("show");

    clearTimeout(window.indicatorTimeout);
    window.indicatorTimeout = setTimeout(() => {
        indicator.classList.remove("show");
    }, 2000);
}

function editRound() {
    const roundSpan = document.getElementById("roundDisplay");

    const input = document.createElement("input");
    input.type = "number";
    input.value = currentRound;
    input.min = "1";
    input.step = "1";
    input.className = "w-16 p-1 border-2 border-indigo-400 rounded-lg text-right font-bold outline-none bg-white dark:bg-slate-700 dark:text-white text-2xl";
    input.style.fontSize = "1.875rem";
    input.style.fontWeight = "900";

    roundSpan.parentNode.replaceChild(input, roundSpan);
    input.focus();

    const saveEdit = () => {
        const newRound = parseInt(input.value);
        if (!isNaN(newRound) && newRound > 0) {
            currentRound = newRound;
        }

        const newSpan = document.createElement("span");
        newSpan.className = "text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-none ronda-editable";
        newSpan.id = "roundDisplay";
        newSpan.onclick = editRound;
        newSpan.title = "Haz clic para editar";
        newSpan.textContent = currentRound;

        input.parentNode.replaceChild(newSpan, input);
        saveToStorage();
    };

    input.onblur = saveEdit;
    input.onkeypress = (e) => { if (e.key === "Enter") saveEdit(); };
}

function addPlayer() {
    const nameInput = document.getElementById("playerName");
    const name = nameInput.value.trim();
    if (!name) return;

    players.push({
        id: Date.now(),
        name: name.substring(0, 20),
        score: 0,
        reengages: 0,
        isEditing: false,
    });

    nameInput.value = "";
    nameInput.focus();
    render();
    saveToStorage();
    showAutoSaveIndicator(`${name} añadido`);
}

function toggleEdit(id) {
    const player = players.find((p) => p.id === id);
    if (player) {
        player.isEditing = !player.isEditing;
        render();
    }
}

function saveManualScore(id, val) {
    const player = players.find((p) => p.id === id);
    if (!player) return;

    const newScore = parseInt(val);
    if (!isNaN(newScore)) {
        player.score = newScore;
        saveToStorage();
    }
    player.isEditing = false;
    render();
}

function reengage(id) {
    const limit = parseInt(document.getElementById("limitInput").value) || 100;
    const activePlayers = players.filter((p) => p.score < limit);
    const maxActiveScore = activePlayers.length > 0 ? Math.max(...activePlayers.map((p) => p.score)) : 0;

    const player = players.find((p) => p.id === id);
    if (!player) return;

    player.score = maxActiveScore;
    player.reengages = (player.reengages || 0) + 1;
    saveToStorage();
    render();
    showAutoSaveIndicator(`${player.name} reenganchado (${player.reengages} ${player.reengages === 1 ? "vez" : "veces"})`);
}

function deleteHistoryItem(id) {
    if (!confirm("¿Eliminar esta partida del historial?")) return;
    history = history.filter((game) => game.id !== id);
    renderHistory();
    saveToStorage();
    showAutoSaveIndicator("Partida eliminada del historial");
}

function clearAllHistory() {
    if (history.length === 0) {
        showAutoSaveIndicator("No hay historial para limpiar");
        return;
    }
    if (!confirm("¿Eliminar TODAS las partidas del historial?")) return;
    history = [];
    renderHistory();
    saveToStorage();
    showAutoSaveIndicator("Historial limpiado");
}

function finishGame() {
    if (players.length === 0) {
        showAutoSaveIndicator("No hay jugadores para finalizar");
        return;
    }

    const winner = [...players].sort((a, b) => a.score - b.score)[0];

    const gameRecord = {
        id: Date.now(),
        date: new Date().toISOString(),
        winner: { name: winner.name, score: winner.score, reengages: winner.reengages || 0 },
        players: players.map((p) => ({ name: p.name, score: p.score, reengages: p.reengages || 0 })),
        limit: parseInt(document.getElementById("limitInput").value) || 100,
        rounds: currentRound,
    };

    history.unshift(gameRecord);
    if (history.length > 20) history = history.slice(0, 20);

    players = [];
    currentRound = 1;

    render();
    renderHistory();
    saveToStorage();
    showAutoSaveIndicator(`Partida finalizada - Ganador: ${winner.name}`);
}

function confirmFinishGame() {
    if (players.length === 0) {
        showAutoSaveIndicator("No hay jugadores para finalizar");
        return;
    }
    if (confirm("¿Finalizar la partida actual? Se guardará en el historial y se iniciará una nueva.")) {
        finishGame();
    }
}

function renderHistory() {
    const historyList = document.getElementById("historyList");
    const historyCount = document.getElementById("historyCount");

    historyCount.textContent = history.length;

    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="text-center py-8 text-slate-400 dark:text-slate-600">
                <i class="fa-regular fa-receipt text-3xl mb-2 opacity-30"></i>
                <p class="text-sm">No hay partidas finalizadas</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = history.map((game) => {
        const date = new Date(game.date);
        const formattedDate = date.toLocaleDateString("es-ES", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        });

        const sortedPlayers = [...game.players].sort((a, b) => a.score - b.score);

        return `
            <div class="history-item bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 flex-1 cursor-pointer" onclick="toggleHistory(${game.id})">
                        <i class="fa-solid fa-trophy text-yellow-500"></i>
                        <span class="font-bold text-sm text-slate-700 dark:text-slate-300">${game.winner.name}</span>
                        <span class="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                            ${game.winner.score} pts
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-slate-400 dark:text-slate-500">
                            <i class="fa-regular fa-calendar mr-1"></i>${formattedDate}
                        </span>
                        <button onclick="deleteHistoryItem(${game.id})"
                                class="delete-history-btn text-slate-400 hover:text-red-500 transition-all p-1"
                                title="Eliminar del historial">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                        <i class="fa-solid fa-chevron-down text-xs text-slate-400 transition-transform cursor-pointer" id="chevron-${game.id}" onclick="toggleHistory(${game.id})"></i>
                    </div>
                </div>

                <div id="history-${game.id}" class="history-expanded mt-2">
                    <div class="pt-3 border-t border-slate-200 dark:border-slate-600 space-y-2">
                        ${sortedPlayers.map((p) => `
                            <div class="flex items-center justify-between text-xs">
                                <div class="flex items-center gap-2">
                                    ${p.name === game.winner.name ? '<i class="fa-solid fa-crown text-yellow-500"></i>' : '<i class="fa-regular fa-circle text-slate-400"></i>'}
                                    <span class="${p.name === game.winner.name ? "font-bold text-yellow-600 dark:text-yellow-400" : "text-slate-600 dark:text-slate-400"}">${p.name}</span>
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="font-mono font-bold ${p.name === game.winner.name ? "text-yellow-600" : "text-slate-500"}">${p.score} pts</span>
                                    ${p.reengages > 0 ? `
                                        <span class="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                            <i class="fa-solid fa-rotate-left mr-1"></i>${p.reengages}
                                        </span>` : ""}
                                </div>
                            </div>
                        `).join("")}
                        <div class="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-2 mt-1 border-t border-slate-100 dark:border-slate-700">
                            <span><i class="fa-regular fa-hourglass-half mr-1"></i>${game.rounds} rondas</span>
                            <span><i class="fa-solid fa-bolt mr-1"></i>Límite: ${game.limit}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

function toggleHistory(id) {
    const element = document.getElementById(`history-${id}`);
    const chevron = document.getElementById(`chevron-${id}`);

    element.classList.toggle("show");
    chevron.style.transform = element.classList.contains("show") ? "rotate(180deg)" : "rotate(0deg)";
}

function render() {
    const list = document.getElementById("playersList");
    const limit = parseInt(document.getElementById("limitInput").value) || 100;
    const btnRound = document.getElementById("btnNextRound");

    document.getElementById("roundDisplay").textContent = currentRound;
    btnRound.classList.toggle("hidden", players.length === 0);

    const activePlayers = players.filter((p) => p.score < limit);
    const minScore = activePlayers.length > 0 ? Math.min(...activePlayers.map((p) => p.score)) : null;

    const sortedPlayers = [...players].sort((a, b) => {
        const aElim = a.score >= limit;
        const bElim = b.score >= limit;
        if (aElim && !bElim) return 1;
        if (!aElim && bElim) return -1;
        return a.score - b.score;
    });

    list.innerHTML = "";

    if (players.length === 0) {
        list.innerHTML = `
            <div class="text-center py-12 px-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                <i class="fa-regular fa-club text-6xl mb-4 opacity-30"></i>
                <p class="text-slate-400 dark:text-slate-500 font-medium">No hay jugadores</p>
                <p class="text-xs text-slate-300 dark:text-slate-600 mt-1">Añade jugadores para comenzar</p>
            </div>
        `;
        return;
    }

    sortedPlayers.forEach((player) => {
        const isEliminated = player.score >= limit;
        const isLeader = player.score === minScore && !isEliminated;
        const maxActiveScore = activePlayers.length > 0 ? Math.max(...activePlayers.map((p) => p.score)) : 0;

        const risk = getRiskLevel(player.score, limit);
        const percentage = Math.min((player.score / limit) * 100, 100);

        player.reengages = player.reengages || 0;

        const div = document.createElement("div");
        div.className = `rounded-xl border transition-all fade-slide ${isEliminated ? "eliminated-card p-3" : "p-4 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:shadow-md"} ${isLeader ? "leader-card" : ""}`;

        div.innerHTML = `
            ${isEliminated ? `
            <div class="flex gap-2 items-center">
                <button onclick="reengage(${player.id})"
                           class="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-black rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all uppercase tracking-wider shadow-lg flex items-center justify-center gap-2">
                        <i class="fa-solid fa-rotate-left"></i>
                        ${player.name} — REENGANCHAR (${maxActiveScore})
                    </button>
            </div>
            ` : `
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-slate-800 dark:text-white truncate">${player.name}</span>
                        <div class="flex gap-1 shrink-0">
                            ${isLeader ? '<span class="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider flex items-center gap-1"><i class="fa-solid fa-crown text-[8px]"></i>LÍDER</span>' : ""}
                        </div>
                    </div>
                    ${player.reengages > 0 ? `
                        <div class="reengage-badge mt-1" title="Veces que se ha reenganchado">
                            <i class="fa-solid fa-rotate-left"></i>
                            <span>${player.reengages} ${player.reengages === 1 ? "vez" : "veces"}</span>
                        </div>` : ""}
                </div>

                <div class="flex items-center gap-2 ml-2">
                    ${player.isEditing
                        ? `<input type="number" value="${player.score}"
                                onblur="saveManualScore(${player.id}, this.value)"
                                onkeypress="if(event.key==='Enter') this.blur()"
                                autofocus
                                class="w-20 p-2 border-2 border-indigo-400 rounded-lg text-right font-bold outline-none bg-white dark:bg-slate-700 dark:text-white">`
                        : `<div class="flex items-center gap-2">
                            <div class="points-remaining ${risk.textColor} ${risk.pulse ? "risk-pulse" : ""}" title="Puntos restantes para eliminar">
                                <i class="${risk.icon}"></i>
                                <span>${risk.remaining}</span>
                            </div>
                            <span class="text-2xl font-black text-slate-700 dark:text-white"
                                  onclick="toggleEdit(${player.id})">${player.score}</span>
                            <button onclick="toggleEdit(${player.id})"
                                    class="text-slate-300 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors p-1">
                                <i class="fa-regular fa-pen-to-square"></i>
                            </button>
                        </div>`
                    }
                </div>
            </div>

            <div class="risk-bar mb-3">
                <div class="risk-fill ${risk.barColor}" style="width: ${percentage}%"></div>
            </div>
            <div class="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-3">
                <span class="flex items-center gap-1">
                    <i class="fa-regular fa-flag"></i>
                </span>
                <span class="flex items-center gap-1">
                    <i class="${risk.icon} ${risk.textColor}"></i>
                    <span class="${risk.textColor}">${Math.round(percentage)}%</span>
                </span>
                <span class="flex items-center gap-1">
                    <i class="fa-solid fa-bolt"></i>
                    <span>${limit}</span>
                </span>
            </div>

            <div class="flex gap-2 items-center">
                <div class="relative flex-1">
                    <input type="number" data-id="${player.id}" placeholder="Puntos..."
                           class="score-input w-full p-3 pr-12 text-sm bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all"
                           onkeypress="if(event.key==='Enter') nextRound()">
                    <i class="fa-solid fa-plus absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm"></i>
                </div>
            </div>
            `}
        `;

        list.appendChild(div);
    });
}

function nextRound() {
    const inputs = document.querySelectorAll(".score-input");
    let somePointsAdded = false;
    let totalAdded = 0;

    inputs.forEach((input) => {
        const val = input.value.trim();
        if (val !== "") {
            const points = parseInt(val);
            if (!isNaN(points) && points !== 0) {
                const player = players.find((p) => p.id === parseInt(input.dataset.id));
                if (player) {
                    player.score += points;
                    totalAdded += points;
                    somePointsAdded = true;
                }
            }
            input.value = "";
        }
    });

    if (somePointsAdded) {
        currentRound++;
        render();
        saveToStorage();
        const sign = totalAdded >= 0 ? "+" : "";
        showAutoSaveIndicator(`Ronda ${currentRound - 1}: ${sign}${totalAdded} pts`);
    }
}

function resetGame() {
    if (!confirm("¿Reiniciar la partida actual? Se perderán todos los jugadores y puntajes.")) return;
    players = [];
    currentRound = 1;
    document.getElementById("limitInput").value = 100;
    render();
    saveToStorage();
    showAutoSaveIndicator("Partida reiniciada");
}

loadFromStorage();
render();
renderHistory();

setInterval(() => { if (players.length > 0) saveToStorage(); }, 30000);
window.addEventListener("beforeunload", () => saveToStorage());