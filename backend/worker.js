import zh from '../assets/combined_game_data.json';
import en from '../assets/data_en.json';
import featured from '../assets/featured-terms.json';
import { createWorker } from './core.mjs';

export default createWorker({ dictionaries: { zh, en }, featured });
