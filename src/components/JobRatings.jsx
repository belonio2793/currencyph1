import './JobRatings.css'

export default function JobRatings({ ratings = [], averageRating = 0 }) {
  const ratingDistribution = {
    5: ratings.filter(r => r.rating_score === 5).length,
    4: ratings.filter(r => r.rating_score === 4).length,
    3: ratings.filter(r => r.rating_score === 3).length,
    2: ratings.filter(r => r.rating_score === 2).length,
    1: ratings.filter(r => r.rating_score === 1).length
  }

  const getRatingStars = (score) => {
    return '⭐'.repeat(score) + '☆'.repeat(5 - score)
  }

  return (
    <div className="ratings-container">
      {ratings.length === 0 ? (
        <div className="empty-state">
          <p>No ratings yet</p>
        </div>
      ) : (
        <>
          {/* Rating Summary */}
          <div className="rating-summary">
            <div className="average-rating">
              <div className="rating-number">{averageRating}</div>
              <div className="rating-stars">{getRatingStars(Math.round(averageRating))}</div>
              <div className="rating-count">Based on {ratings.length} reviews</div>
            </div>

            {/* Rating Distribution */}
            <div className="rating-distribution">
              {[5, 4, 3, 2, 1].map(score => (
                <div key={score} className="distribution-item">
                  <span className="stars">{score}⭐</span>
                  <div className="bar">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(ratingDistribution[score] / ratings.length) * 100}%`
                      }}
                    />
                  </div>
                  <span className="count">{ratingDistribution[score]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Individual Reviews */}
          <div className="reviews-list">
            {ratings.map(rating => (
              <div key={rating.id} className="review-card">
                <div className="review-header">
                  <div className="review-user">
                    <div className="user-avatar">👤</div>
                    <div className="user-info">
                      <h5>{rating.review_title || 'Unnamed Review'}</h5>
                      <p className="user-name">By User {rating.rated_by_user_id?.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="review-rating">
                    <span className="stars">{getRatingStars(rating.rating_score)}</span>
                    <span className="score">{rating.rating_score}/5</span>
                  </div>
                </div>

                {rating.review_text && (
                  <div className="review-body">
                    <p>{rating.review_text}</p>
                  </div>
                )}

                <div className="review-footer">
                  <span className="date">
                    {new Date(rating.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
