const AlgorithmModel = require('../models/algorithmModel');
const humps = require('humps');

const AlgorithmController = {
    getMaxAlgorithm: async (req, res) => {
        try {
            const result = await AlgorithmModel.getMaxAlgorithm();
            res.json(humps.camelizeKeys(result));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getMinAlgorithm: async (req, res) => {
        try {
            const result = await AlgorithmModel.getMinAlgorithm();
            res.json(humps.camelizeKeys(result));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getBestAlgorithm: async (req, res) => {
        try {
            const result = await AlgorithmModel.getBestAlgorithm();
            res.json(humps.camelizeKeys(result));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getWorstAlgorithm: async (req, res) => {
        try {
            const result = await AlgorithmModel.getWorstAlgorithm();
            res.json(humps.camelizeKeys(result));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = AlgorithmController;
