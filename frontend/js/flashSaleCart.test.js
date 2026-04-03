/**
 * Unit Test – Flash Sale (Branch & Condition Coverage)
 * 
 * Tương ứng mục 5.5 trong báo cáo KTPM.
 * Kỹ thuật: Branch & Condition Coverage (4 điểm quyết định)
 * Framework: Jest (JavaScript)
 * 
 * Method được test: addToCartFromFlashSale(product, quantity)
 * 
 * Các điều kiện:
 * D1: product === null || product === undefined → SP không tồn tại
 * D2: !isFlashSaleActive() → Sale đã kết thúc
 * D3: product.flashStock <= 0 → Hết hàng
 * D4: quantity <= 0 || quantity > product.flashStock → SL không hợp lệ
 */

const { addToCartFromFlashSale, isFlashSaleActive } = require('./flashSaleCart');

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = value; }),
        removeItem: jest.fn(key => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; })
    };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('addToCartFromFlashSale - Branch & Condition Coverage', () => {

    beforeEach(() => {
        localStorageMock.clear();
        // Mặc định Flash Sale đang hoạt động (end time = 1 giờ nữa)
        global.window = {
            __flashSaleEndTime: new Date(Date.now() + 3600000).toISOString()
        };
    });

    afterEach(() => {
        delete global.window;
    });

    // ==================== TC_WB_BC_01 ====================
    /**
     * TC_WB_BC_01: Sản phẩm không tồn tại (null)
     * D1 = True (D1a: product === null)
     * Kết quả mong đợi: { success: false, message: "Sản phẩm không tồn tại" }
     */
    test('TC_WB_BC_01: SP là null → thông báo SP không tồn tại', () => {
        const result = addToCartFromFlashSale(null, 1);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Sản phẩm không tồn tại");
    });

    // ==================== TC_WB_BC_02 ====================
    /**
     * TC_WB_BC_02: Sản phẩm undefined
     * D1 = True (D1b: product === undefined)
     * Kết quả mong đợi: { success: false, message: "Sản phẩm không tồn tại" }
     */
    test('TC_WB_BC_02: SP là undefined → thông báo lỗi', () => {
        const result = addToCartFromFlashSale(undefined, 1);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Sản phẩm không tồn tại");
    });

    // ==================== TC_WB_BC_03 ====================
    /**
     * TC_WB_BC_03: Flash Sale đã kết thúc
     * D1 = False, D2 = True
     * Kết quả mong đợi: { success: false, message: "Flash Sale đã kết thúc" }
     */
    test('TC_WB_BC_03: Sale đã kết thúc → thông báo Sale đã kết thúc', () => {
        // Đặt thời gian kết thúc sale = 1 giờ trước
        global.window.__flashSaleEndTime = new Date(Date.now() - 3600000).toISOString();

        const product = { id: 1, name: "Áo Flash", flashPrice: 99000, flashStock: 5 };
        const result = addToCartFromFlashSale(product, 1);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Flash Sale đã kết thúc");
    });

    // ==================== TC_WB_BC_04 ====================
    /**
     * TC_WB_BC_04: Hết hàng Flash Sale (flashStock = 0)
     * D1 = False, D2 = False, D3 = True
     * Kết quả mong đợi: { success: false, message: "Sản phẩm đã hết hàng" }
     */
    test('TC_WB_BC_04: Hết hàng Flash Sale → thông báo Hết hàng', () => {
        const product = { id: 1, name: "Áo Flash", flashPrice: 99000, flashStock: 0 };
        const result = addToCartFromFlashSale(product, 1);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Sản phẩm đã hết hàng");
    });

    // ==================== TC_WB_BC_05 ====================
    /**
     * TC_WB_BC_05: Số lượng âm hoặc bằng 0
     * D1 = False, D2 = False, D3 = False, D4 = True (D4a: quantity <= 0)
     * Kết quả mong đợi: { success: false, message: "Số lượng không hợp lệ" }
     */
    test('TC_WB_BC_05: Số lượng = 0 → SL không hợp lệ', () => {
        const product = { id: 1, name: "Áo Flash", flashPrice: 99000, flashStock: 5 };
        const result = addToCartFromFlashSale(product, 0);

        expect(result.success).toBe(false);
        expect(result.message).toBe("Số lượng không hợp lệ");
    });

    // ==================== TC_WB_BC_06 ====================
    /**
     * TC_WB_BC_06: Số lượng vượt flash stock
     * D1 = False, D2 = False, D3 = False, D4 = True (D4b: quantity > flashStock)
     * Kết quả mong đợi: { success: false, message: "Số lượng không hợp lệ" }
     */
    test('TC_WB_BC_06: SL vượt flash stock → vượt giới hạn mua', () => {
        const product = { id: 1, name: "Áo Flash", flashPrice: 99000, flashStock: 3 };
        const result = addToCartFromFlashSale(product, 5); // > flashStock

        expect(result.success).toBe(false);
        expect(result.message).toBe("Số lượng không hợp lệ");
    });

    // ==================== TC_WB_BC_07 ====================
    /**
     * TC_WB_BC_07: Thêm vào giỏ hàng hợp lệ
     * D1 = False, D2 = False, D3 = False, D4 = False
     * Kết quả mong đợi: { success: true, message: "Đã thêm vào giỏ hàng thành công" }
     */
    test('TC_WB_BC_07: Thêm giỏ hợp lệ → giỏ cập nhật với giá Flash Sale', () => {
        const product = { id: 1, name: "Áo Flash", flashPrice: 99000, flashStock: 5 };
        const result = addToCartFromFlashSale(product, 2);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Đã thêm vào giỏ hàng thành công");

        // Kiểm tra localStorage đã được cập nhật
        expect(localStorageMock.setItem).toHaveBeenCalled();
        const savedCart = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
        expect(savedCart).toHaveLength(1);
        expect(savedCart[0].productId).toBe(1);
        expect(savedCart[0].price).toBe(99000);
        expect(savedCart[0].quantity).toBe(2);
        expect(savedCart[0].isFlashSale).toBe(true);
    });

    // ==================== TC_WB_BC_08 ====================
    /**
     * TC_WB_BC_08: SL đúng bằng flash stock (biên)
     * D1 = False, D2 = False, D3 = False, D4 = False
     * Kết quả mong đợi: { success: true, message: "Đã thêm vào giỏ hàng thành công" }
     */
    test('TC_WB_BC_08: SL đúng bằng flash stock → thêm thành công', () => {
        const product = { id: 2, name: "Quần Flash", flashPrice: 149000, flashStock: 3 };
        const result = addToCartFromFlashSale(product, 3); // === flashStock

        expect(result.success).toBe(true);
        expect(result.message).toBe("Đã thêm vào giỏ hàng thành công");
    });
});
