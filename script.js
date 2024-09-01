let data = [];
let journals = [];
let tokens = [];
let initialNodes = [];
let initialEdges = [];
let initialLayout = {};

// Preload the JSONL file
document.addEventListener("DOMContentLoaded", () => {
    fetch('part-1.jsonl')
        .then(response => response.text())
        .then(text => {
            const lines = text.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const jsonLine = JSON.parse(line);
                    data.push(jsonLine);
                    if (!journals.includes(jsonLine.isPartOf)) {
                        journals.push(jsonLine.isPartOf);
                    }
                }
            });
            populateJournalSelect();
            generateCrisisRatioGraph();
            generateGraph();
            generateProbabilityGraph();
        })
        .catch(error => console.error('Error loading JSONL file:', error));
});

document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const lines = e.target.result.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const jsonLine = JSON.parse(line);
                    data.push(jsonLine);
                    if (!journals.includes(jsonLine.isPartOf)) {
                        journals.push(jsonLine.isPartOf);
                    }
                }
            });
            populateJournalSelect();
        };
        reader.readAsText(file);
    }
});

function populateJournalSelect() {
    const journalSelect = document.getElementById('journalSelect');
    journalSelect.innerHTML = '';
    journals.forEach(journal => {
        const option = document.createElement('option');
        option.value = journal;
        option.textContent = journal;
        journalSelect.appendChild(option);
    });
}

function getTokensForSelectedJournal() {
    const selectedJournal = document.getElementById('journalSelect').value;
    const journalData = data.filter(item => item.isPartOf === selectedJournal);
    const fullText = journalData.map(item => item.fullText).join(' ');
    return fullText.toLowerCase().split(/\W+/);
}

function calculateRatio(text, wordCount, targetWord) {
    if (Array.isArray(text) && wordCount > 0) {
        const targetCount = text.reduce((acc, t) => acc + (t.toLowerCase().match(new RegExp(targetWord.toLowerCase(), 'g')) || []).length, 0);
        return targetCount / wordCount;
    }
    return 0;
}

function generateCrisisRatioGraph() {
    const selectedJournal = document.getElementById('journalSelect').value;
    const targetWord = document.getElementById('targetWord').value;
    const journalData = data.filter(item => item.isPartOf === selectedJournal);

    journalData.forEach(item => {
        item.crisis_ratio = calculateRatio(item.fullText, item.wordCount, targetWord);
    });

    const crisisRatioByYear = journalData.reduce((acc, item) => {
        if (!acc[item.publicationYear]) {
            acc[item.publicationYear] = { sum: 0, count: 0 };
        }
        acc[item.publicationYear].sum += item.crisis_ratio;
        acc[item.publicationYear].count++;
        return acc;
    }, {});

    const years = Object.keys(crisisRatioByYear).sort();
    const meanCrisisRatios = years.map(year => crisisRatioByYear[year].sum / crisisRatioByYear[year].count);

    const trace = {
        x: years,
        y: meanCrisisRatios,
        type: 'bar',
        marker: { color: 'lightcoral' }
    };

    const layout = {
        title: `Mean Ratio of "${targetWord}" Per Year for ${selectedJournal}`,
        xaxis: { title: 'Year' },
        yaxis: { 
            title: `Mean Ratio of "${targetWord}"`,
            tickformat: '.6f'
        }
    };

    Plotly.newPlot('crisisRatioGraph', [trace], layout);
}

function getCommonWords() {
    const textAreaValue = document.getElementById('commonWordsText').value;
    return new Set(textAreaValue.split(',').map(word => word.trim()));
}

document.getElementById('contextWindowSize').addEventListener('input', function() {
    document.getElementById('contextWindowSizeValue').textContent = this.value;
});

document.getElementById('neighborWeight').addEventListener('input', function() {
    document.getElementById('neighborWeightValue').textContent = this.value;
});

document.getElementById('targetProximityStrength').addEventListener('input', function() {
    document.getElementById('targetProximityStrengthValue').textContent = this.value;
});

function populateNeighborSelect(topWords) {
    const neighborSelect = document.getElementById('neighborSelect');
    neighborSelect.innerHTML = '';
    topWords.forEach(([word]) => {
        const option = document.createElement('option');
        option.value = word;
        option.textContent = word;
        neighborSelect.appendChild(option);
    });
}

function calculatePMI(word1, word2, tokens, contextWindowSize) {
    const totalTokens = tokens.length;
    const freqWord1 = tokens.filter(word => word === word1).length;
    const freqWord2 = tokens.filter(word => word === word2).length;

    let coOccurrence = 0;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === word1) {
            const start = Math.max(i - contextWindowSize, 0);
            const end = Math.min(i + contextWindowSize + 1, tokens.length);
            if (tokens.slice(start, end).includes(word2)) {
                coOccurrence++;
            }
        }
    }

    const P_x = freqWord1 / totalTokens;
    const P_y = freqWord2 / totalTokens;
    const P_xy = coOccurrence / totalTokens;

    if (P_x === 0 || P_y === 0 || P_xy === 0 || isNaN(P_xy)) {
        return Number.NEGATIVE_INFINITY;
    }

    const pmi = Math.log2(P_xy / (P_x * P_y));
    return pmi;
}

function getSelectedNeighbor() {
    const neighborSelect = document.getElementById('neighborSelect').value;
    const neighborInput = document.getElementById('neighborInput').value.trim();
    
    return neighborInput || neighborSelect;
}

function displayPMI() {
    const targetWord = document.getElementById('targetWord').value;
    const selectedNeighbor = getSelectedNeighbor();
    const contextWindowSize = parseInt(document.getElementById('contextWindowSize').value);
    const tokens = getTokensForSelectedJournal();

    const pmi = calculatePMI(targetWord, selectedNeighbor, tokens, contextWindowSize);

    const pmiResult = document.getElementById('pmiResult');
    if (pmi === Number.NEGATIVE_INFINITY) {
        pmiResult.textContent = `PMI between "${targetWord}" and "${selectedNeighbor}" could not be calculated (probabilities are zero or no co-occurrence found).`;
    } else {
        pmiResult.textContent = `PMI between "${targetWord}" and "${selectedNeighbor}": ${pmi.toFixed(4)}`;
    }
}

function generateGraph() {
    const targetWord = document.getElementById('targetWord').value;
    const contextWindowSize = parseInt(document.getElementById('contextWindowSize').value);
    const topWordsCount = parseInt(document.getElementById('topWordsCount').value);
    const neighborsCount = parseInt(document.getElementById('neighborsCount').value);
    const selectedJournal = document.getElementById('journalSelect').value;
    const commonWords = getCommonWords();

    const neighborWeight = parseFloat(document.getElementById('neighborWeight').value);
    const targetProximityStrength = parseFloat(document.getElementById('targetProximityStrength').value);

    const journalData = data.filter(item => item.isPartOf === selectedJournal);
    const fullText = journalData.map(item => item.fullText).join(' ');
    tokens = fullText.toLowerCase().split(/\W+/);

    tokens = tokens.filter(word => !commonWords.has(word));

    const relatedWords = [];
    const neighborsDict = {};

    tokens.forEach((word, i) => {
        if (word === targetWord) {
            const start = Math.max(i - contextWindowSize, 0);
            const end = Math.min(i + contextWindowSize + 1, tokens.length);
            const context = tokens.slice(start, i).concat(tokens.slice(i + 1, end));
            relatedWords.push(...context);

            context.forEach(relatedWord => {
                if (!neighborsDict[relatedWord]) {
                    neighborsDict[relatedWord] = [];
                }
                neighborsDict[relatedWord].push(...context.filter(w => w !== relatedWord));
            });
        }
    });

    const wordFreq = {};
    relatedWords.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    const topWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topWordsCount);

    populateNeighborSelect(topWords);

    const G = new Map();
    G.set(targetWord, wordFreq[targetWord] || 1);

    const edges = [];

    topWords.forEach(([word, freq]) => {
        G.set(word, freq);
        edges.push([targetWord, word]);

        if (neighborsDict[word]) {
            const neighbors = Object.entries(neighborsDict[word].reduce((acc, w) => {
                acc[w] = (acc[w] || 0) + 1;
                return acc;
            }, {}))
            .sort((a, b) => b[1] - a[1])
            .slice(0, neighborsCount);

            neighbors.forEach(([neighbor]) => {
                if (!G.has(neighbor)) {
                    G.set(neighbor, 1);
                }
                if (neighborsDict[neighbor].includes(word)) {
                    edges.push([word, neighbor]);
                }
            });
        }
    });

    const maxFreq = Math.max(...Array.from(G.values()));

    const nodes = [];
    const nodeMap = new Map();

    G.forEach((size, word) => {
        const connectedEdges = edges.filter(edge => edge.includes(word)).length;

        const targetProximity = Math.pow(1 - (size / maxFreq), targetProximityStrength / 4);
        let neighborProximity = 1;
        if (neighborsDict[word]) {
            neighborProximity = Math.pow(connectedEdges, -neighborWeight * 2);
        }
        const combinedProximity = (targetProximity * (1 - neighborWeight)) + (neighborProximity * neighborWeight);

        const scale = 10;
        const node = {
            x: (Math.random() - 0.5) * combinedProximity * scale,
            y: (Math.random() - 0.5) * combinedProximity * scale,
            z: (Math.random() - 0.5) * combinedProximity * scale,
            text: size > 1 ? `${word}: ${size}` : word,
            size: 10,
            word: word,
            color: size
        };
        nodes.push(node);
        nodeMap.set(word, node);
    });

    const targetNode = nodeMap.get(targetWord);
    if (targetNode) {
        targetNode.x = 0.5;
        targetNode.y = 0.5;
        targetNode.z = 0.5;
    }

    initialNodes = nodes.map(node => ({ ...node }));
    initialEdges = [...edges];

    const xValues = nodes.map(node => node.x);
    const yValues = nodes.map(node => node.y);
    const zValues = nodes.map(node => node.z);

    const xRange = [Math.min(...xValues) - 1, Math.max(...xValues) + 1];
    const yRange = [Math.min(...yValues) - 1, Math.max(...yValues) + 1];
    const zRange = [Math.min(...zValues) - 1, Math.max(...zValues) + 1];

    const minRange = [-5, 5];
    const adjustedXRange = [
        Math.min(minRange[0], xRange[0]),
        Math.max(minRange[1], xRange[1])
    ];
    const adjustedYRange = [
        Math.min(minRange[0], yRange[0]),
        Math.max(minRange[1], yRange[1])
    ];
    const adjustedZRange = [
        Math.min(minRange[0], zRange[0]),
        Math.max(minRange[1], zRange[1])
    ];

    initialLayout = {
        title: `  `,
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis: { range: adjustedXRange, showbackground: false },
            yaxis: { range: adjustedYRange, showbackground: false },
            zaxis: { range: adjustedZRange, showbackground: false }
        },
        showlegend: false
    };

    const nodeTrace = {
        x: nodes.map(node => node.x),
        y: nodes.map(node => node.y),
        z: nodes.map(node => node.z),
        text: nodes.map(node => node.text),
        mode: 'markers+text',
        marker: {
            size: 10,
            color: nodes.map(node => node.color),
            colorscale: 'YlGnBu',
            colorbar: {
                title: {
                    text: 'Frequency to target word',
                },
                len: 0.8
            }
        },
        type: 'scatter3d',
        clickmode: 'event+select'
    };

    const edgeTrace = {
        x: [],
        y: [],
        z: [],
        mode: 'lines',
        line: {
            width: 0.5,
            color: '#888'
        },
        type: 'scatter3d'
    };

    edges.forEach(([from, to]) => {
        const fromNode = nodeMap.get(from);
        const toNode = nodeMap.get(to);
        if (fromNode && toNode) {
            edgeTrace.x.push(fromNode.x, toNode.x, null);
            edgeTrace.y.push(fromNode.y, toNode.y, null);
            edgeTrace.z.push(fromNode.z, toNode.z, null);
        }
    });

    Plotly.newPlot('graph', [edgeTrace, nodeTrace], initialLayout);

    document.getElementById('graph').on('plotly_click', function(data) {
        if (data.points[0].curveNumber === 1) {
            const clickedNode = data.points[0].text.split(':')[0];
            const clickedEdges = initialEdges.filter(edge => edge.includes(clickedNode));
            const neighborNodes = new Set();

            clickedEdges.forEach(([from, to]) => {
                if (from !== targetWord && from !== clickedNode) neighborNodes.add(from);
                if (to !== targetWord && to !== clickedNode) neighborNodes.add(to);
            });

            const filteredEdges = clickedEdges.filter(edge => 
                edge.includes(targetWord) || edge.includes(clickedNode)
            );

            const filteredNodes = [targetWord, clickedNode, ...neighborNodes];
            const newNodes = initialNodes.filter(node => filteredNodes.includes(node.word));
            const newEdges = [];

            filteredEdges.forEach(([from, to]) => {
                const fromNode = nodeMap.get(from);
                const toNode = nodeMap.get(to);
                if (fromNode && toNode) {
                    newEdges.push([fromNode, toNode]);
                }
            });

            const newEdgeTrace = {
                x: [],
                y: [],
                z: [],
                mode: 'lines',
                line: {
                    width: 0.5,
                    color: '#888'
                },
                type: 'scatter3d'
            };

            newEdges.forEach(([fromNode, toNode]) => {
                newEdgeTrace.x.push(fromNode.x, toNode.x, null);
                newEdgeTrace.y.push(fromNode.y, toNode.y, null);
                newEdgeTrace.z.push(fromNode.z, toNode.z, null);
            });

            Plotly.newPlot('graph', [newEdgeTrace, {
                x: newNodes.map(node => node.x),
                y: newNodes.map(node => node.y),
                z: newNodes.map(node => node.z),
                text: newNodes.map(node => node.text),
                mode: 'markers+text',
                marker: {
                    size: 10,
                    color: newNodes.map(node => node.color),
                    colorscale: 'YlGnBu',
                    colorbar: {
                        title: {
                            text: 'Frequency to target word',
                        },
                        len: 0.8
                    }
                },
                type: 'scatter3d'
            }], initialLayout);
        }
    });
}

function generateProbabilityGraph() {
    const targetWord = document.getElementById('targetWord').value;
    const selectedNeighbor = getSelectedNeighbor();
    const contextWindowSize = parseInt(document.getElementById('contextWindowSize').value);
    const tokens = getTokensForSelectedJournal();

    const totalTokens = tokens.length;
    const positionCounts = Array(contextWindowSize * 2 + 1).fill(0);

    for (let i = 0; i < totalTokens; i++) {
        if (tokens[i] === targetWord) {
            const start = Math.max(i - contextWindowSize, 0);
            const end = Math.min(i + contextWindowSize + 1, totalTokens);

            for (let j = start; j < end; j++) {
                if (tokens[j] === selectedNeighbor && j !== i) {
                    const relativePosition = j - i + contextWindowSize;
                    positionCounts[relativePosition]++;
                }
            }
        }
    }

    const xValues = Array.from({ length: contextWindowSize * 2 + 1 }, (_, idx) => idx - contextWindowSize);

    const trace = {
        x: xValues,
        y: positionCounts,
        type: 'line'
    };

    const layout = {
        title: `Count of "${selectedNeighbor}" Around "${targetWord}"`,
        xaxis: { title: 'Position Relative to Target Word' },
        yaxis: { title: 'Count' }
    };

    Plotly.newPlot('probabilityGraph', [trace], layout);
}

document.getElementById('calculatePMIButton').addEventListener('click', displayPMI);
document.getElementById('calculateProbabilityGraph').addEventListener('click', generateProbabilityGraph);