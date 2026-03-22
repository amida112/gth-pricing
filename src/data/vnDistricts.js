// Danh sách quận/huyện/thị xã theo 34 tỉnh/thành sau sáp nhập 2025
// Dùng làm datalist gợi ý cho field "Xã/Phường/Quận/Huyện" khi chọn tỉnh thành phố
export const VN_DISTRICTS = {
  'Hà Nội': [
    // Quận nội thành
    'Ba Đình', 'Hoàn Kiếm', 'Đống Đa', 'Hai Bà Trưng', 'Hoàng Mai', 'Long Biên',
    'Nam Từ Liêm', 'Bắc Từ Liêm', 'Cầu Giấy', 'Thanh Xuân', 'Hà Đông', 'Tây Hồ', 'Sơn Tây',
    // Huyện Hà Nội
    'Ba Vì', 'Chương Mỹ', 'Đan Phượng', 'Đông Anh', 'Gia Lâm', 'Hoài Đức', 'Mê Linh',
    'Mỹ Đức', 'Phú Xuyên', 'Phúc Thọ', 'Quốc Oai', 'Sóc Sơn', 'Thạch Thất', 'Thanh Oai',
    'Thanh Trì', 'Thường Tín', 'Ứng Hòa',
    // Hòa Bình (sáp nhập)
    'TP. Hòa Bình', 'Cao Phong', 'Đà Bắc', 'Kim Bôi', 'Kỳ Sơn', 'Lạc Sơn', 'Lạc Thủy',
    'Lương Sơn', 'Mai Châu', 'Tân Lạc', 'Yên Thủy',
    // Hà Nam (sáp nhập)
    'Phủ Lý', 'Bình Lục', 'Duy Tiên', 'Kim Bảng', 'Lý Nhân', 'Thanh Liêm',
  ],
  'Hải Phòng': [
    // Quận Hải Phòng
    'Hồng Bàng', 'Ngô Quyền', 'Lê Chân', 'Kiến An', 'Hải An', 'Đồ Sơn', 'Dương Kinh',
    // Huyện Hải Phòng
    'An Dương', 'An Lão', 'Bạch Long Vỹ', 'Cát Hải', 'Kiến Thụy', 'Thủy Nguyên', 'Tiên Lãng', 'Vĩnh Bảo',
    // Hải Dương (sáp nhập)
    'TP. Hải Dương', 'Chí Linh', 'Bình Giang', 'Cẩm Giàng', 'Gia Lộc', 'Kim Thành',
    'Kinh Môn', 'Nam Sách', 'Ninh Giang', 'Thanh Hà', 'Thanh Miện', 'Tứ Kỳ',
  ],
  'Quảng Ninh': [
    'Hạ Long', 'Cẩm Phả', 'Uông Bí', 'Móng Cái', 'Đông Triều', 'Quảng Yên',
    'Ba Chẽ', 'Bình Liêu', 'Cô Tô', 'Đầm Hà', 'Hải Hà', 'Tiên Yên', 'Vân Đồn',
  ],
  'Bắc Ninh': [
    // Bắc Ninh
    'TP. Bắc Ninh', 'Từ Sơn', 'Gia Bình', 'Lương Tài', 'Quế Võ', 'Thuận Thành', 'Tiên Du', 'Yên Phong',
    // Bắc Giang (sáp nhập)
    'TP. Bắc Giang', 'Hiệp Hòa', 'Lạng Giang', 'Lục Nam', 'Lục Ngạn', 'Sơn Động',
    'Tân Yên', 'Việt Yên', 'Yên Dũng', 'Yên Thế',
  ],
  'Thái Nguyên': [
    // Thái Nguyên
    'TP. Thái Nguyên', 'Sông Công', 'Phổ Yên', 'Định Hóa', 'Đại Từ', 'Đồng Hỷ',
    'Phú Bình', 'Phú Lương', 'Võ Nhai',
    // Bắc Kạn (sáp nhập)
    'TP. Bắc Kạn', 'Ba Bể', 'Bạch Thông', 'Chợ Đồn', 'Chợ Mới', 'Na Rì', 'Ngân Sơn', 'Pác Nặm',
    // Cao Bằng (sáp nhập)
    'TP. Cao Bằng', 'Bảo Lâm', 'Bảo Lạc', 'Hà Quảng', 'Hạ Lang', 'Hòa An', 'Nguyên Bình',
    'Phục Hòa', 'Quảng Uyên', 'Thạch An', 'Thông Nông', 'Trà Lĩnh', 'Trùng Khánh',
  ],
  'Lạng Sơn': [
    'TP. Lạng Sơn', 'Bắc Sơn', 'Bình Gia', 'Cao Lộc', 'Chi Lăng', 'Đình Lập',
    'Hữu Lũng', 'Lộc Bình', 'Tràng Định', 'Văn Lãng', 'Văn Quan',
  ],
  'Tuyên Quang': [
    // Tuyên Quang
    'TP. Tuyên Quang', 'Chiêm Hóa', 'Hàm Yên', 'Lâm Bình', 'Na Hang', 'Sơn Dương', 'Yên Sơn',
    // Hà Giang (sáp nhập)
    'TP. Hà Giang', 'Bắc Mê', 'Bắc Quang', 'Đồng Văn', 'Hoàng Su Phì', 'Mèo Vạc',
    'Quản Bạ', 'Quang Bình', 'Vị Xuyên', 'Xín Mần', 'Yên Minh',
  ],
  'Lào Cai': [
    // Lào Cai
    'TP. Lào Cai', 'Bảo Thắng', 'Bảo Yên', 'Bát Xát', 'Mường Khương', 'Sa Pa', 'Si Ma Cai', 'Văn Bàn',
    // Yên Bái (sáp nhập)
    'TP. Yên Bái', 'Nghĩa Lộ', 'Lục Yên', 'Mù Cang Chải', 'Trấn Yên', 'Trạm Tấu',
    'Văn Chấn', 'Văn Yên', 'Yên Bình',
  ],
  'Sơn La': [
    // Sơn La
    'TP. Sơn La', 'Bắc Yên', 'Mai Sơn', 'Mộc Châu', 'Mường La', 'Phù Yên',
    'Quỳnh Nhai', 'Sông Mã', 'Sốp Cộp', 'Thuận Châu', 'Vân Hồ', 'Yên Châu',
    // Điện Biên (sáp nhập)
    'TP. Điện Biên Phủ', 'TX. Mường Lay', 'Điện Biên', 'Điện Biên Đông', 'Mường Ảng',
    'Mường Chà', 'Mường Nhé', 'Nậm Pồ', 'Tủa Chùa', 'Tuần Giáo',
    // Lai Châu (sáp nhập)
    'TP. Lai Châu', 'Mường Tè', 'Nậm Nhùn', 'Phong Thổ', 'Sìn Hồ', 'Tam Đường', 'Tân Uyên', 'Than Uyên',
  ],
  'Phú Thọ': [
    // Phú Thọ
    'Việt Trì', 'Phú Thọ', 'Cẩm Khê', 'Đoan Hùng', 'Hạ Hòa', 'Lâm Thao', 'Phù Ninh',
    'Tam Nông', 'Tân Sơn', 'Thanh Ba', 'Thanh Sơn', 'Thanh Thủy', 'Yên Lập',
    // Vĩnh Phúc (sáp nhập)
    'Vĩnh Yên', 'Phúc Yên', 'Bình Xuyên', 'Lập Thạch', 'Sông Lô', 'Tam Đảo',
    'Tam Dương', 'Vĩnh Tường', 'Yên Lạc',
  ],
  'Hưng Yên': [
    // Hưng Yên
    'TP. Hưng Yên', 'Ân Thi', 'Kim Động', 'Khoái Châu', 'Mỹ Hào', 'Phù Cừ',
    'Tiên Lữ', 'Văn Giang', 'Văn Lâm', 'Yên Mỹ',
    // Thái Bình (sáp nhập)
    'TP. Thái Bình', 'Đông Hưng', 'Hưng Hà', 'Kiến Xương', 'Quỳnh Phụ',
    'Thái Thụy', 'Tiền Hải', 'Vũ Thư',
  ],
  'Nam Định': [
    // Nam Định
    'TP. Nam Định', 'Giao Thủy', 'Hải Hậu', 'Mỹ Lộc', 'Nam Trực', 'Nghĩa Hưng',
    'Trực Ninh', 'Vụ Bản', 'Xuân Trường', 'Ý Yên',
    // Ninh Bình (sáp nhập)
    'TP. Ninh Bình', 'TX. Tam Điệp', 'Gia Viễn', 'Hoa Lư', 'Kim Sơn',
    'Nho Quan', 'Yên Khánh', 'Yên Mô',
  ],
  'Thanh Hóa': [
    'TP. Thanh Hóa', 'TX. Bỉm Sơn', 'TX. Sầm Sơn', 'Bá Thước', 'Cẩm Thủy', 'Đông Sơn',
    'Hà Trung', 'Hậu Lộc', 'Hoằng Hóa', 'Lang Chánh', 'Mường Lát', 'Nga Sơn', 'Ngọc Lặc',
    'Như Thanh', 'Như Xuân', 'Nông Cống', 'Quan Hóa', 'Quan Sơn', 'Quảng Xương',
    'Nghi Sơn', 'Thạch Thành', 'Thiệu Hóa', 'Thọ Xuân', 'Thường Xuân', 'Triệu Sơn',
    'Vĩnh Lộc', 'Yên Định',
  ],
  'Nghệ An': [
    // Nghệ An
    'TP. Vinh', 'TX. Cửa Lò', 'TX. Thái Hòa', 'Anh Sơn', 'Con Cuông', 'Diễn Châu',
    'Đô Lương', 'Hưng Nguyên', 'Kỳ Sơn', 'Nam Đàn', 'Nghi Lộc', 'Nghĩa Đàn',
    'Quế Phong', 'Quỳ Châu', 'Quỳ Hợp', 'Quỳnh Lưu', 'Tân Kỳ', 'Thanh Chương',
    'Tương Dương', 'Yên Thành',
    // Hà Tĩnh (sáp nhập)
    'TP. Hà Tĩnh', 'TX. Hồng Lĩnh', 'TX. Kỳ Anh', 'Can Lộc', 'Cẩm Xuyên', 'Đức Thọ',
    'Hương Khê', 'Hương Sơn', 'Kỳ Anh', 'Lộc Hà', 'Nghi Xuân', 'Thạch Hà', 'Vũ Quang',
  ],
  'Quảng Bình': [
    // Quảng Bình
    'TP. Đồng Hới', 'TX. Ba Đồn', 'Bố Trạch', 'Lệ Thủy', 'Minh Hóa', 'Quảng Ninh', 'Quảng Trạch', 'Tuyên Hóa',
    // Quảng Trị (sáp nhập)
    'TP. Đông Hà', 'TX. Quảng Trị', 'Cam Lộ', 'Cồn Cỏ', 'Đakrông', 'Gio Linh',
    'Hải Lăng', 'Hướng Hóa', 'Triệu Phong', 'Vĩnh Linh',
  ],
  'Thừa Thiên Huế': [
    'TP. Huế', 'A Lưới', 'Hương Thủy', 'Hương Trà', 'Nam Đông', 'Phong Điền', 'Phú Lộc', 'Phú Vang', 'Quảng Điền',
  ],
  'Đà Nẵng': [
    // Quận Đà Nẵng
    'Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang',
    // Quảng Nam (sáp nhập)
    'TP. Tam Kỳ', 'TP. Hội An', 'TX. Điện Bàn', 'Bắc Trà My', 'Đại Lộc', 'Duy Xuyên',
    'Hiệp Đức', 'Nam Giang', 'Nam Trà My', 'Nông Sơn', 'Núi Thành', 'Phú Ninh',
    'Phước Sơn', 'Quế Sơn', 'Tây Giang', 'Thăng Bình', 'Tiên Phước',
  ],
  'Quảng Ngãi': [
    // Quảng Ngãi
    'TP. Quảng Ngãi', 'Ba Tơ', 'Bình Sơn', 'Đức Phổ', 'Lý Sơn', 'Minh Long', 'Mộ Đức',
    'Nghĩa Hành', 'Sơn Hà', 'Sơn Tây', 'Sơn Tinh', 'Tây Trà', 'Trà Bồng', 'Tư Nghĩa',
    // Bình Định (sáp nhập)
    'TP. Quy Nhơn', 'TX. An Nhơn', 'TX. Hoài Nhơn', 'An Lão', 'Hoài Ân', 'Phù Cát',
    'Phù Mỹ', 'Tây Sơn', 'Tuy Phước', 'Vân Canh', 'Vĩnh Thạnh',
  ],
  'Phú Yên': [
    // Phú Yên
    'TP. Tuy Hòa', 'TX. Sông Cầu', 'Đồng Xuân', 'Đông Hòa', 'Phú Hòa', 'Sông Hinh',
    'Sơn Hòa', 'Tây Hòa', 'Tuy An',
    // Khánh Hòa (sáp nhập)
    'TP. Nha Trang', 'TP. Cam Ranh', 'TX. Ninh Hòa', 'Cam Lâm', 'Diên Khánh',
    'Khánh Sơn', 'Khánh Vĩnh', 'Vạn Ninh',
    // Ninh Thuận (sáp nhập)
    'TP. Phan Rang - Tháp Chàm', 'Bác Ái', 'Ninh Hải', 'Ninh Phước', 'Ninh Sơn', 'Thuận Bắc', 'Thuận Nam',
  ],
  'Kon Tum': [
    // Kon Tum
    'TP. Kon Tum', 'Đắk Glei', 'Đắk Hà', 'Đắk Tô', 'Ia H\'Drai', 'Kon Plông',
    'Kon Rẫy', 'Ngọc Hồi', 'Sa Thầy', 'Tu Mơ Rông',
    // Gia Lai (sáp nhập)
    'TP. Pleiku', 'TX. An Khê', 'TX. Ayun Pa', 'Chư Păh', 'Chư Prông', 'Chư Pưh',
    'Chư Sê', 'Đắk Đoa', 'Đắk Pơ', 'Đức Cơ', 'Ia Grai', 'Ia Pa', 'K\'Bang',
    'Kông Chro', 'Krông Pa', 'Mang Yang', 'Phú Thiện',
  ],
  'Đắk Lắk': [
    // Đắk Lắk
    'TP. Buôn Ma Thuột', 'TX. Buôn Hồ', 'Buôn Đôn', 'Cư Kuin', 'Cư M\'gar',
    'Ea H\'Leo', 'Ea Kar', 'Ea Súp', 'Krông Ana', 'Krông Bông', 'Krông Búk',
    'Krông Năng', 'Krông Pắc', 'Lắk', 'M\'Đrắk',
    // Đắk Nông (sáp nhập)
    'TP. Gia Nghĩa', 'Cư Jút', 'Đắk Glong', 'Đắk Mil', 'Đắk R\'Lấp', 'Đắk Song', 'Krông Nô', 'Tuy Đức',
  ],
  'Lâm Đồng': [
    // Lâm Đồng
    'TP. Đà Lạt', 'TP. Bảo Lộc', 'Bảo Lâm', 'Cát Tiên', 'Di Linh', 'Đạ Huoai',
    'Đạ Tẻh', 'Đam Rông', 'Đơn Dương', 'Đức Trọng', 'Lạc Dương', 'Lâm Hà',
    // Bình Thuận (sáp nhập)
    'TP. Phan Thiết', 'TX. La Gi', 'Bắc Bình', 'Đức Linh', 'Hàm Thuận Bắc',
    'Hàm Thuận Nam', 'Hàm Tân', 'Phú Quý', 'Tánh Linh', 'Tuy Phong',
  ],
  'Bình Phước': [
    // Bình Phước
    'TP. Đồng Xoài', 'TX. Bình Long', 'TX. Phước Long', 'Bù Đăng', 'Bù Đốp',
    'Bù Gia Mập', 'Chơn Thành', 'Đồng Phú', 'Hớn Quản', 'Lộc Ninh', 'Phú Riềng',
    // Tây Ninh (sáp nhập)
    'TP. Tây Ninh', 'Châu Thành', 'Dương Minh Châu', 'Gò Dầu', 'Hòa Thành',
    'Tân Biên', 'Tân Châu', 'Tân Thành', 'Trảng Bàng',
  ],
  'Đồng Nai': [
    // Đồng Nai
    'TP. Biên Hòa', 'TP. Long Khánh', 'Cẩm Mỹ', 'Định Quán', 'Long Thành',
    'Nhơn Trạch', 'Tân Phú', 'Thống Nhất', 'Trảng Bom', 'Vĩnh Cửu', 'Xuân Lộc',
    // Bà Rịa - Vũng Tàu (sáp nhập)
    'TP. Vũng Tàu', 'TP. Bà Rịa', 'Châu Đức', 'Côn Đảo', 'Đất Đỏ',
    'Long Điền', 'Phú Mỹ', 'Xuyên Mộc',
  ],
  'TP. Hồ Chí Minh': [
    // Quận nội thành
    'Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7', 'Quận 8',
    'Quận 10', 'Quận 11', 'Quận 12', 'Bình Tân', 'Bình Thạnh', 'Gò Vấp',
    'Phú Nhuận', 'Tân Bình', 'Tân Phú',
    // TP/Huyện HCM
    'TP. Thủ Đức', 'Bình Chánh', 'Cần Giờ', 'Củ Chi', 'Hóc Môn', 'Nhà Bè',
    // Bình Dương (sáp nhập)
    'TP. Thủ Dầu Một', 'TP. Dĩ An', 'TP. Thuận An', 'TP. Bến Cát', 'Bàu Bàng',
    'Dầu Tiếng', 'Phú Giáo', 'Tân Uyên', 'Bắc Tân Uyên',
    // Long An (sáp nhập)
    'TP. Tân An', 'TX. Kiến Tường', 'Bến Lức', 'Cần Đước', 'Cần Giuộc', 'Châu Thành',
    'Đức Hòa', 'Đức Huệ', 'Mộc Hóa', 'Tân Hưng', 'Tân Thạnh', 'Tân Trụ',
    'Thạnh Hóa', 'Thủ Thừa', 'Vĩnh Hưng',
  ],
  'Cần Thơ': [
    // Quận Cần Thơ
    'Ninh Kiều', 'Bình Thủy', 'Cái Răng', 'Ô Môn', 'Thốt Nốt', 'Cờ Đỏ', 'Phong Điền', 'Thới Lai', 'Vĩnh Thạnh',
    // Hậu Giang (sáp nhập)
    'TP. Vị Thanh', 'TX. Ngã Bảy', 'Châu Thành', 'Châu Thành A', 'Long Mỹ', 'Phụng Hiệp', 'Vị Thủy',
  ],
  'Tiền Giang': [
    // Tiền Giang
    'TP. Mỹ Tho', 'TX. Gò Công', 'TX. Cai Lậy', 'Cái Bè', 'Châu Thành', 'Chợ Gạo',
    'Gò Công Đông', 'Gò Công Tây', 'Tân Phú Đông', 'Tân Phước',
    // Bến Tre (sáp nhập)
    'TP. Bến Tre', 'Ba Tri', 'Bình Đại', 'Châu Thành', 'Chợ Lách', 'Giồng Trôm',
    'Mỏ Cày Bắc', 'Mỏ Cày Nam', 'Thạnh Phú',
    // Vĩnh Long (sáp nhập)
    'TP. Vĩnh Long', 'TX. Bình Minh', 'Bình Tân', 'Long Hồ', 'Mang Thít', 'Tam Bình', 'Trà Ôn', 'Vũng Liêm',
    // Trà Vinh (sáp nhập)
    'TP. Trà Vinh', 'TX. Duyên Hải', 'Càng Long', 'Cầu Kè', 'Cầu Ngang', 'Châu Thành', 'Tiểu Cần', 'Trà Cú',
  ],
  'An Giang': [
    // An Giang
    'TP. Long Xuyên', 'TP. Châu Đốc', 'TX. Tân Châu', 'An Phú', 'Châu Phú', 'Châu Thành',
    'Chợ Mới', 'Phú Tân', 'Thoại Sơn', 'Tịnh Biên', 'Tri Tôn',
    // Kiên Giang (sáp nhập)
    'TP. Rạch Giá', 'TP. Phú Quốc', 'TX. Hà Tiên', 'Châu Thành', 'Giang Thành',
    'Giồng Riềng', 'Gò Quao', 'Hòn Đất', 'Kiên Hải', 'Kiên Lương', 'Tân Hiệp',
    'U Minh Thượng', 'Vĩnh Thuận',
  ],
  'Đồng Tháp': [
    'TP. Cao Lãnh', 'TP. Sa Đéc', 'TX. Hồng Ngự', 'Cao Lãnh', 'Châu Thành', 'Hồng Ngự',
    'Lai Vung', 'Lấp Vò', 'Tam Nông', 'Tân Hồng', 'Tháp Mười', 'Thanh Bình',
  ],
  'Sóc Trăng': [
    // Sóc Trăng
    'TP. Sóc Trăng', 'TX. Ngã Năm', 'TX. Vĩnh Châu', 'Châu Thành', 'Cù Lao Dung',
    'Kế Sách', 'Long Phú', 'Mỹ Tú', 'Mỹ Xuyên', 'Thạnh Trị', 'Trần Đề',
    // Bạc Liêu (sáp nhập)
    'TP. Bạc Liêu', 'TX. Giá Rai', 'Đông Hải', 'Hòa Bình', 'Hồng Dân', 'Phước Long', 'Vĩnh Lợi',
    // Cà Mau (sáp nhập)
    'TP. Cà Mau', 'Đầm Dơi', 'Cái Nước', 'Năm Căn', 'Ngọc Hiển', 'Phú Tân',
    'Thới Bình', 'Trần Văn Thời', 'U Minh',
  ],
};
