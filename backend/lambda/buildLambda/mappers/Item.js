"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapDdbResponseToItem = mapDdbResponseToItem;
// DynamoDB Mapper Function
function mapDdbResponseToItem(item) {
    return {
        sk: item.sk?.S, // DynamoDB string type
        item_id: item.item_id?.S ?? '',
        institution_id: item.institution_id?.S ?? '',
        institution_name: item.institution_name?.S ?? '',
        created_at: item.created_at?.S ?? '',
        pk: item.pk?.S ?? '',
        __typename: 'Item',
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSXRlbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tYXBwZXJzL0l0ZW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFLQSxvREFVQztBQVhELDJCQUEyQjtBQUMzQixTQUFnQixvQkFBb0IsQ0FBQyxJQUF1QztJQUN4RSxPQUFPO1FBQ0gsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLHVCQUF1QjtRQUN2QyxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRTtRQUM5QixjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksRUFBRTtRQUM1QyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLEVBQUU7UUFDaEQsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQUU7UUFDcEMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUU7UUFDcEIsVUFBVSxFQUFFLE1BQU07S0FDckIsQ0FBQTtBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBdHRyaWJ1dGVWYWx1ZSB9IGZyb20gJ2F3cy1zZGsvY2xpZW50cy9keW5hbW9kYicgLy8gVGhpcyBpcyB0aGUgZm9ybWF0IHVzZWQgYnkgRHluYW1vREIgZm9yIGF0dHJpYnV0ZXNcbmltcG9ydCB7IEl0ZW0gfSBmcm9tICcuLi9BUEknXG5pbXBvcnQgeyBhbnkgfSBmcm9tICd6b2QnXG5cbi8vIER5bmFtb0RCIE1hcHBlciBGdW5jdGlvblxuZXhwb3J0IGZ1bmN0aW9uIG1hcERkYlJlc3BvbnNlVG9JdGVtKGl0ZW06IHsgW2tleTogc3RyaW5nXTogQXR0cmlidXRlVmFsdWUgfSk6IEl0ZW0ge1xuICAgIHJldHVybiB7XG4gICAgICAgIHNrOiBpdGVtLnNrPy5TLCAvLyBEeW5hbW9EQiBzdHJpbmcgdHlwZVxuICAgICAgICBpdGVtX2lkOiBpdGVtLml0ZW1faWQ/LlMgPz8gJycsXG4gICAgICAgIGluc3RpdHV0aW9uX2lkOiBpdGVtLmluc3RpdHV0aW9uX2lkPy5TID8/ICcnLFxuICAgICAgICBpbnN0aXR1dGlvbl9uYW1lOiBpdGVtLmluc3RpdHV0aW9uX25hbWU/LlMgPz8gJycsXG4gICAgICAgIGNyZWF0ZWRfYXQ6IGl0ZW0uY3JlYXRlZF9hdD8uUyA/PyAnJyxcbiAgICAgICAgcGs6IGl0ZW0ucGs/LlMgPz8gJycsXG4gICAgICAgIF9fdHlwZW5hbWU6ICdJdGVtJyxcbiAgICB9XG59XG4iXX0=