/**
 * Module Flash Sale Cart
 * Xử lý logic thêm sản phẩm Flash Sale vào giỏ hàng.
 * File nguồn: frontend/js/flashSaleCart.js
 */

// ==================== Hàm kiểm tra Flash Sale ====================

/**
 * Kiểm tra Flash Sale còn hiệu lực hay không.
 * @returns {boolean} true nếu flash sale còn hoạt động
 */
function isFlashSaleActive() {
    const now = new Date();
    const endTime = window.__flashSaleEndTime;
    if (!endTime) return false;
    return now < new Date(endTime);
}

/**
 * Thêm sản phẩm Flash Sale vào giỏ hàng.
 * Kiểm tra: sản phẩm tồn tại, flash sale còn hiệu lực, còn hàng, số lượng hợp lệ.
 * 
 * @param {Object|null|undefined} product - Đối tượng sản phẩm Flash Sale
 * @param {number} quantity - Số lượng muốn mua
 * @returns {{ success: boolean, message: string }} Kết quả thêm giỏ hàng
 */
function addToCartFromFlashSale(product, quantity) {
    // D1: Kiểm tra sản phẩm tồn tại
    if (product === null || product === undefined) {
        return { success: false, message: "Sản phẩm không tồn tại" };
    }

    // D2: Kiểm tra Flash Sale còn hiệu lực
    if (!isFlashSaleActive()) {
        return { success: false, message: "Flash Sale đã kết thúc" };
    }

    // D3: Kiểm tra còn hàng Flash Sale
    if (product.flashStock <= 0) {
        return { success: false, message: "Sản phẩm đã hết hàng" };
    }

    // D4: Kiểm tra số lượng hợp lệ
    if (quantity <= 0 || quantity > product.flashStock) {
        return { success: false, message: "Số lượng không hợp lệ" };
    }

    // Thêm vào giỏ hàng với giá Flash Sale
    const cartItem = {
        productId: product.id,
        name: product.name,
        price: product.flashPrice,
        quantity: quantity,
        isFlashSale: true
    };

    // Lưu vào localStorage
    let cart = JSON.parse(localStorage.getItem('flashCart') || '[]');
    const existingIndex = cart.findIndex(item => item.productId === product.id);
    if (existingIndex >= 0) {
        cart[existingIndex].quantity += quantity;
    } else {
        cart.push(cartItem);
    }
    localStorage.setItem('flashCart', JSON.stringify(cart));

    return { success: true, message: "Đã thêm vào giỏ hàng thành công" };
}

// Export cho Jest test
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { addToCartFromFlashSale, isFlashSaleActive };
}
