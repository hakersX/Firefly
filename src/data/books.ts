// ============================================================================
// 书籍页面书架配置
// 添加书籍步骤：
// 1. 将 PDF 文件放入 public/assets/books/
// 2. 将封面图放入 public/assets/books/cover/（可选）
// 3. 在下方数组添加一条记录
// ============================================================================

export interface BookItem {
	/** 唯一标识，用作 DOM key 与状态 */
	id: string;
	/** 书名 */
	title: string;
	/** 作者 */
	author: string;
	/** 简介 */
	description: string;
	/** PDF 文件路径（相对 public，如 /assets/books/xxx.pdf） */
	pdf: string;
	/** 封面图路径（相对 public，可选，缺失时用毛玻璃占位） */
	cover?: string;
}

export const bookshelf: BookItem[] = [
	// 示例：
	// {
	// 	id: "demo-book",
	// 	title: "示例书名",
	// 	author: "佚名",
	// 	description: "这是一段简介，简要描述这本书的内容与主题。",
	// 	pdf: "/assets/books/demo.pdf",
	// 	cover: "/assets/books/cover/demo.jpg",
	// },
// 	{
//     id: "cljs18",
//     title: "查理九世18",
//     author: "雷欧幻像",
//     description: "",
//     pdf: "/assets/books/18•地狱温泉的诅咒.pdf",  // 可选，不写会显示毛玻璃占位
//   },
// 	{
//     id: "cljs27",
//     title: "查理九世27",
//     author: "雷欧幻像",
//     description: "",
//     pdf: "/assets/books/27•九尾灵猫.pdf",  // 可选，不写会显示毛玻璃占位
//   },
  
];
