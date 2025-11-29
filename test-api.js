"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var node_fetch_1 = require("node-fetch");
var API_URL = "http://localhost:3000/api/products";
var API_KEY = "MaSuperCleSecrete123";
function fetchAllProducts() {
    return __awaiter(this, void 0, void 0, function () {
        var allProducts, page, limit, total, res, data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    allProducts = [];
                    page = 1;
                    limit = 50;
                    total = 0;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, (0, node_fetch_1.default)("".concat(API_URL, "?page=").concat(page, "&limit=").concat(limit), {
                            headers: { "x-rapidapi-key": API_KEY }
                        })];
                case 2:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error("Erreur HTTP: ".concat(res.status));
                    return [4 /*yield*/, res.json()];
                case 3:
                    data = _a.sent();
                    allProducts = allProducts.concat(data.products);
                    total = data.total;
                    console.log("\u2705 Page ".concat(page, " r\u00E9cup\u00E9r\u00E9e (").concat(allProducts.length, "/").concat(total, ")"));
                    page++;
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 400); })];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    err_1 = _a.sent();
                    console.error("\u274C Erreur sur la page ".concat(page, ":"), err_1.message);
                    return [3 /*break*/, 7];
                case 6:
                    if (allProducts.length < total) return [3 /*break*/, 1];
                    _a.label = 7;
                case 7:
                    fs_1.default.writeFileSync('allProducts.json', JSON.stringify(allProducts, null, 2));
                    console.log("\uD83C\uDF89 ".concat(allProducts.length, " produits enregistr\u00E9s dans allProducts.json"));
                    return [2 /*return*/];
            }
        });
    });
}
fetchAllProducts();
